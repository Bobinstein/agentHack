/**
 * AO Relay Monitor - Cleaned and Simplified Version
 *
 * This module monitors AO processes for relay requests and handles HTTP forwarding
 * with support for custom APIs like GusHasTheBestPrices.com, Brevo, and OpenWeather.
 *
 * Key Features:
 * - Monitors AO processes for relay requests via GraphQL
 * - Handles HTTP requests with API key replacement
 * - Custom token price fetching via Vento SDK
 * - Web3Form compatibility with browser-like headers
 * - SQLite database for request tracking
 * - Graceful error handling and retry logic
 *
 * Environment Variables:
 * - MOCK_RELAY_PROCESS_ID: AO process ID for the mock relay
 * - CRONTROLLER_PROCESS_ID: AO process ID for the crontroller
 * - CHECK_INTERVAL: Monitoring interval in milliseconds
 * - GRAPHQL_FAILURE_DELAY: Delay before retrying GraphQL after failures
 * - MAX_GRAPHQL_FAILURES: Maximum consecutive GraphQL failures before fallback
 * - GUS_PRICE_REQUIRED_BEARER_TOKEN: Bearer token for Gus price API
 * - VENTO_RETRY_LIMIT: Maximum retry attempts for Vento SDK calls
 * - VENTO_RETRY_DELAY: Delay between Vento SDK retry attempts
 * - BREVO_API_KEY: API key for Brevo email service
 * - BREVO_API_KEY_PLACEHOLDER: Placeholder text for Brevo API key
 * - OPENWEATHER_API_KEY: API key for OpenWeather service
 * - OPENWEATHER_API_KEY_PLACEHOLDER: Placeholder text for OpenWeather API key
 * - AO_WALLET_PATH: Path to AO wallet file (supports ~ for home directory)
 * - GATEWAY_URL: Arweave gateway URL for AO operations
 * - MU_URL: AO MU (Message Unit) endpoint URL
 * - CU_URL: AO CU (Compute Unit) endpoint URL
 */

// Load environment variables from .env file
require("dotenv").config();

const {
  connect,
  createDataItemSigner,
  monitor,
  unmonitor,
} = require("@permaweb/aoconnect");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { VentoClient } = require("@vela-ventures/vento-sdk");

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

// AO Process IDs
const MOCK_RELAY_PROCESS_ID = process.env.MOCK_RELAY_PROCESS_ID;
const CRONTROLLER_PROCESS_ID = process.env.CRONTROLLER_PROCESS_ID;

// GraphQL endpoints - Goldsky is faster, use as primary
const GOLDSKY_PRIMARY_ENDPOINT = "https://arweave-search.goldsky.com/graphql";
const ARWEAVE_FALLBACK_ENDPOINT = "https://arweave.net/graphql";

// Timing configuration
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 1 minute
const GRAPHQL_FAILURE_DELAY =
  parseInt(process.env.GRAPHQL_FAILURE_DELAY) || 120000; // 2 minutes
const MAX_GRAPHQL_FAILURES = parseInt(process.env.MAX_GRAPHQL_FAILURES) || 3;

// Database configuration
const DB_PATH = "./relay_requests.db";

// GusHasTheBestPrices.com API configuration
const GUS_PRICE_API_PATTERN =
  /^https:\/\/GusHasTheBestPrices\.com\/api\/v69\/price\/(.+)$/;
const WUSDC_TOKEN_ID = "7zH9dlMNoxprab9loshv3Y7WG45DOny_Vrq9KrXObdQ";
const GUS_PRICE_REQUIRED_BEARER_TOKEN =
  process.env.GUS_PRICE_REQUIRED_BEARER_TOKEN;
const VENTO_RETRY_LIMIT = parseInt(process.env.VENTO_RETRY_LIMIT) || 10;
const VENTO_RETRY_DELAY = parseInt(process.env.VENTO_RETRY_DELAY) || 2000; // 2 seconds between retries

// API Key configuration with placeholders for security
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_KEY_PLACEHOLDER = process.env.BREVO_API_KEY_PLACEHOLDER;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_API_KEY_PLACEHOLDER =
  process.env.OPENWEATHER_API_KEY_PLACEHOLDER;

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

/**
 * Validate that all required environment variables are present
 */
function validateEnvironment() {
  const requiredVars = [
    "MOCK_RELAY_PROCESS_ID",
    "CRONTROLLER_PROCESS_ID",
    "GUS_PRICE_REQUIRED_BEARER_TOKEN",
    "BREVO_API_KEY",
    "BREVO_API_KEY_PLACEHOLDER",
    "OPENWEATHER_API_KEY",
    "OPENWEATHER_API_KEY_PLACEHOLDER",
    "AO_WALLET_PATH",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => console.error(`   - ${varName}`));
    console.error(
      "\nPlease check your .env file and ensure all required variables are set."
    );
    process.exit(1);
  }

  console.log("✅ All required environment variables are present");
}

// ============================================================================
// GLOBAL STATE VARIABLES
// ============================================================================

// GraphQL failure tracking for circuit breaker pattern
let consecutiveGraphQLFailures = 0;

// Global variable for cron monitor (used in shutdown handlers)
let globalCronMonitor = null;

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

/**
 * Initialize SQLite database with WAL mode for better concurrency
 * Creates the relay_requests table if it doesn't exist
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    console.log(`Initializing database at: ${DB_PATH}`);

    // Ensure the database directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("Failed to open database:", err);
        reject(err);
        return;
      }

      // Enable WAL mode for better concurrency
      db.run("PRAGMA journal_mode = WAL", (err) => {
        if (err) {
          console.warn("Failed to enable WAL mode:", err);
        }
      });

      // Create the relay_requests table
      db.run(
        `CREATE TABLE IF NOT EXISTS relay_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_txid TEXT UNIQUE NOT NULL,
          response_txid TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          url TEXT NOT NULL,
          method TEXT NOT NULL,
          headers TEXT,
          body TEXT,
          timeout INTEGER DEFAULT 30000,
          status TEXT DEFAULT 'pending',
          axios_response TEXT,
          error TEXT
        )`,
        (err) => {
          if (err) {
            console.error("Failed to create table:", err);
            reject(err);
          } else {
            console.log("Database initialized successfully");
            resolve(db);
          }
        }
      );
    });
  });
}

/**
 * Check if a request has already been processed by looking up its transaction ID
 */
function isRequestProcessed(db, requestTxid) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id FROM relay_requests WHERE request_txid = ?",
      [requestTxid],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      }
    );
  });
}

/**
 * Record a new request in the database
 */
function recordRequest(db, txid, tags) {
  return new Promise((resolve, reject) => {
    const { URL, Method, Headers, Body, Timeout } = tags;

    // Parse headers to check for special request types
    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(Headers || "{}");
    } catch (e) {
      parsedHeaders = {};
    }

    // Log special request types for debugging
    const isWeb3Form =
      parsedHeaders["Is-Web3-Form"] === "true" ||
      parsedHeaders["is-web3-form"] === "true";
    if (isWeb3Form) {
      console.log("    🚀 Web3Form request detected");
    }

    const hasPostData = tags["Post-Data"] && tags["Post-Data"].trim() !== "";
    if (hasPostData) {
      console.log("    📝 Post-Data tag found");
    }

    // Insert the request into database
    db.run(
      `INSERT INTO relay_requests (
        request_txid, url, method, headers, body, timeout
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        txid,
        URL,
        Method,
        Headers || "{}",
        Body || "",
        parseInt(Timeout) || 30000,
      ],
      function (err) {
        if (err) {
          console.error("Database error recording request:", err);
          reject(err);
        } else {
          console.log(`Request recorded with ID: ${this.lastID}`);
          resolve(this.lastID);
        }
      }
    );
  });
}

/**
 * Update database with response data
 */
function updateRequestWithResponse(db, requestId, responseTxid, axiosResponse) {
  return new Promise((resolve, reject) => {
    const responseData = JSON.stringify(axiosResponse);
    const status = axiosResponse.success ? "completed" : "failed";
    const error = axiosResponse.success ? null : axiosResponse.error;

    db.run(
      `UPDATE relay_requests 
       SET response_txid = ?, status = ?, axios_response = ?, error = ?
       WHERE id = ?`,
      [responseTxid, status, responseData, error, requestId],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract tags from transaction into a key-value object
 */
function extractTags(tags) {
  const tagMap = {};
  tags.forEach((tag) => {
    tagMap[tag.name] = tag.value;
  });
  return tagMap;
}

/**
 * Replace API key placeholders with actual keys in data
 */
function replaceApiKeyPlaceholders(data) {
  if (typeof data === "string") {
    // Replace Brevo API key placeholder
    data = data.replace(
      new RegExp(
        BREVO_API_KEY_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "g"
      ),
      BREVO_API_KEY
    );

    // Replace OpenWeather API key placeholder
    data = data.replace(
      new RegExp(
        OPENWEATHER_API_KEY_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "g"
      ),
      OPENWEATHER_API_KEY
    );
  }
  return data;
}

/**
 * Filter out API keys from response data for security
 */
function filterApiKeyFromResponse(data) {
  if (typeof data === "string") {
    // Replace actual Brevo API key with placeholder in responses
    data = data.replace(
      new RegExp(BREVO_API_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      BREVO_API_KEY_PLACEHOLDER
    );

    // Replace actual OpenWeather API key with placeholder in responses
    data = data.replace(
      new RegExp(
        OPENWEATHER_API_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "g"
      ),
      OPENWEATHER_API_KEY_PLACEHOLDER
    );
  }
  return data;
}

/**
 * Detect error responses even when status is 200 (common with ArIO gateways)
 */
function detectErrorResponse(axiosResponse) {
  if (!axiosResponse.success) return true;

  // Check if response contains error indicators
  if (axiosResponse.data) {
    const data = axiosResponse.data;

    // Check for HTML error pages
    if (typeof data === "string") {
      const lowerData = data.toLowerCase();
      if (
        lowerData.includes("<!doctype html>") &&
        (lowerData.includes("error") ||
          lowerData.includes("not found") ||
          lowerData.includes("404"))
      ) {
        return true;
      }
    }

    // Check for JSON error responses
    if (typeof data === "object" && data.error) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// GUS PRICE API FUNCTIONS
// ============================================================================

/**
 * Check if request is for Gus price API
 */
function isGusPriceRequest(url) {
  return GUS_PRICE_API_PATTERN.test(url);
}

/**
 * Extract token ID from Gus price API URL
 */
function extractTokenIdFromGusUrl(url) {
  const match = url.match(GUS_PRICE_API_PATTERN);
  return match ? match[1] : null;
}

/**
 * Validate HighFive bearer token for Gus price API
 */
function validateHighFiveAuth(headers) {
  try {
    const parsedHeaders = JSON.parse(headers || "{}");
    const authHeader =
      parsedHeaders["Authorization"] || parsedHeaders["authorization"];

    if (!authHeader) {
      console.log(`    ❌ No Authorization header found`);
      return false;
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.log(`    ❌ Authorization header is not Bearer token`);
      return false;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    if (token !== GUS_PRICE_REQUIRED_BEARER_TOKEN) {
      console.log(`    ❌ Invalid bearer token: ${token}`);
      return false;
    }

    console.log(`    ✅ HighFive bearer token validated successfully`);
    return true;
  } catch (error) {
    console.log(
      `    ❌ Error parsing headers for auth validation: ${error.message}`
    );
    return false;
  }
}

/**
 * Fetch token price using Vento SDK with retry logic
 * Converts token to wUSDC and calculates USD price
 */
async function fetchTokenPrice(tokenId, denomination) {
  console.log(
    `    🪙 Fetching price for token ${tokenId} with denomination ${denomination}`
  );

  // Validate inputs
  if (!tokenId || typeof tokenId !== "string") {
    throw new Error("Invalid token ID provided");
  }

  if (
    !denomination ||
    isNaN(denomination) ||
    denomination < 0 ||
    denomination > 18
  ) {
    throw new Error(
      `Invalid denomination: ${denomination}. Must be between 0 and 18`
    );
  }

  // Calculate 1 full token amount based on denomination
  const fullTokenAmount = "1" + "0".repeat(denomination);
  console.log(
    `    📊 1 full token = ${fullTokenAmount} (denomination: ${denomination})`
  );

  const client = new VentoClient({});

  for (let attempt = 1; attempt <= VENTO_RETRY_LIMIT; attempt++) {
    try {
      console.log(`    🔄 Vento SDK attempt ${attempt}/${VENTO_RETRY_LIMIT}`);

      const quote = await client.getSwapQuote({
        fromTokenId: tokenId,
        toTokenId: WUSDC_TOKEN_ID,
        amount: fullTokenAmount,
        userAddress: "j6R9ITLNyll_nckPdnvUGz_sSdnuLVGFIWbymj72SJM", // Using the address from priceFetch.js
      });

      console.log(`    ✅ Vento SDK call successful on attempt ${attempt}`);
      console.log(`    📈 Quote received:`, quote);

      // Check if routes are available
      if (!quote.routes || quote.routes.length === 0) {
        console.log(`    ⚠️ No routes available in quote response`);
        if (attempt < VENTO_RETRY_LIMIT) {
          console.log(
            `    🔄 Retrying... (${attempt + 1}/${VENTO_RETRY_LIMIT})`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, VENTO_RETRY_DELAY)
          );
          continue;
        } else {
          throw new Error("No routes available after all retry attempts");
        }
      }

      // Extract the estimated output (wUSDC amount)
      const estimatedOutput =
        quote.estimatedOutput ||
        (quote.bestRoute && quote.bestRoute.estimatedOutput) ||
        (quote.routes && quote.routes[0] && quote.routes[0].estimatedOutput);

      if (!estimatedOutput) {
        throw new Error("No estimatedOutput found in quote response");
      }

      // Debug: Show where estimatedOutput was found
      if (quote.estimatedOutput) {
        console.log(
          `    📍 Found estimatedOutput at top level: ${quote.estimatedOutput}`
        );
      } else if (quote.bestRoute && quote.bestRoute.estimatedOutput) {
        console.log(
          `    📍 Found estimatedOutput in bestRoute: ${quote.bestRoute.estimatedOutput}`
        );
      } else if (
        quote.routes &&
        quote.routes[0] &&
        quote.routes[0].estimatedOutput
      ) {
        console.log(
          `    📍 Found estimatedOutput in routes[0]: ${quote.routes[0].estimatedOutput}`
        );
      }

      console.log(`    💰 Estimated output: ${estimatedOutput} wUSDC`);

      // Validate estimatedOutput is a valid number
      const estimatedOutputNum = parseFloat(estimatedOutput);
      if (isNaN(estimatedOutputNum) || estimatedOutputNum < 0) {
        throw new Error(`Invalid estimatedOutput: ${estimatedOutput}`);
      }

      // Convert to USD price (assuming 1 wUSDC = $1)
      const usdPrice = estimatedOutputNum;
      console.log(`    💵 USD Price: $${usdPrice.toFixed(6)}`);

      return {
        success: true,
        estimatedOutput,
        usdPrice,
        quote,
      };
    } catch (error) {
      console.log(
        `    ❌ Vento SDK attempt ${attempt} failed: ${error.message}`
      );

      // Don't retry on certain types of errors
      if (
        error.message.includes("Invalid token") ||
        error.message.includes("Token not found") ||
        error.message.includes("Unsupported token")
      ) {
        console.log(`    🚨 Non-retryable error detected, stopping retries`);
        throw error;
      }

      if (attempt < VENTO_RETRY_LIMIT) {
        console.log(
          `    🔄 Retrying in ${VENTO_RETRY_DELAY}ms... (${
            attempt + 1
          }/${VENTO_RETRY_LIMIT})`
        );
        await new Promise((resolve) => setTimeout(resolve, VENTO_RETRY_DELAY));
      } else {
        console.log(`    🚨 All ${VENTO_RETRY_LIMIT} attempts failed`);
        throw new Error(
          `Vento SDK failed after ${VENTO_RETRY_LIMIT} attempts: ${error.message}`
        );
      }
    }
  }

  throw new Error("Unexpected end of retry loop");
}

// ============================================================================
// HTTP REQUEST HANDLING
// ============================================================================

/**
 * Make HTTP request using axios with API key replacement and special handling
 * Supports Gus price API, Web3Forms, Brevo, and OpenWeather APIs
 */
async function makeHttpRequest(url, method, headers, body, timeout, postData) {
  try {
    console.log(`    Making ${method.toUpperCase()} request to: ${url}`);

    // Handle Gus price API requests
    if (isGusPriceRequest(url)) {
      console.log(`    🪙 Gus price API request detected`);

      // Validate HighFive bearer token
      if (!validateHighFiveAuth(headers)) {
        return {
          success: false,
          error: "Unauthorized: Invalid or missing HighFive bearer token",
          code: 401,
          status: 401,
          statusText: "Unauthorized",
        };
      }

      // Extract token ID from URL
      const tokenId = extractTokenIdFromGusUrl(url);
      if (!tokenId) {
        return {
          success: false,
          error: "Invalid token ID in URL",
          code: 400,
          status: 400,
          statusText: "Bad Request",
        };
      }

      console.log(`    🪙 Token ID extracted: ${tokenId}`);

      // Get denomination from headers (X-Denomination tag)
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(headers || "{}");
      } catch (e) {
        parsedHeaders = {};
      }

      const denomination = parseInt(parsedHeaders["X-Denomination"] || "12");
      console.log(`    📊 Using denomination: ${denomination}`);

      try {
        // Fetch token price using Vento SDK
        const priceResult = await fetchTokenPrice(tokenId, denomination);

        if (priceResult.success) {
          // Mock successful axios response
          const mockResponse = {
            success: true,
            status: 200,
            statusText: "OK",
            headers: {
              "content-type": "application/json",
              "x-token-id": tokenId,
              "x-denomination": denomination.toString(),
              "x-usd-price": priceResult.usdPrice.toString(),
            },
            data: {
              tokenId: tokenId,
              denomination: denomination,
              estimatedOutput: priceResult.estimatedOutput,
              usdPrice: priceResult.usdPrice,
              quote: priceResult.quote,
              message: `Successfully fetched price for token ${tokenId}`,
              timestamp: new Date().toISOString(),
            },
          };

          console.log(`    ✅ Gus price API request completed successfully`);
          console.log(
            `    💰 Token ${tokenId} price: $${priceResult.usdPrice.toFixed(6)}`
          );

          return mockResponse;
        } else {
          return {
            success: false,
            error: "Failed to fetch token price",
            code: 500,
            status: 500,
            statusText: "Internal Server Error",
          };
        }
      } catch (priceError) {
        console.log(`    ❌ Gus price API error: ${priceError.message}`);
        return {
          success: false,
          error: `Price fetching failed: ${priceError.message}`,
          code: 500,
          status: 500,
          statusText: "Internal Server Error",
        };
      }
    }

    // Parse headers safely
    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(headers || "{}");
    } catch (e) {
      console.warn(
        "Failed to parse headers as JSON, using empty headers:",
        e.message
      );
      parsedHeaders = {};
    }

    // Create axios config
    const config = {
      method: method.toLowerCase(),
      url,
      headers: parsedHeaders,
      timeout: parseInt(timeout) || 30000,
      validateStatus: () => true, // Don't throw on HTTP error status
    };

    // Replace API key placeholders with actual keys
    let totalReplacements = 0;

    // Replace in URL
    if (config.url.includes(BREVO_API_KEY_PLACEHOLDER)) {
      config.url = config.url.replace(
        new RegExp(
          BREVO_API_KEY_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g"
        ),
        BREVO_API_KEY
      );
      totalReplacements++;
      console.log("    🔑 Replaced Brevo API key in URL");
    }

    if (config.url.includes(OPENWEATHER_API_KEY_PLACEHOLDER)) {
      config.url = config.url.replace(
        new RegExp(
          OPENWEATHER_API_KEY_PLACEHOLDER.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          ),
          "g"
        ),
        OPENWEATHER_API_KEY
      );
      totalReplacements++;
      console.log("    🌤️ Replaced OpenWeather API key in URL");
    }

    // Replace in headers
    for (const [key, value] of Object.entries(parsedHeaders)) {
      if (typeof value === "string") {
        if (value.includes(BREVO_API_KEY_PLACEHOLDER)) {
          parsedHeaders[key] = value.replace(
            new RegExp(
              BREVO_API_KEY_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "g"
            ),
            BREVO_API_KEY
          );
          totalReplacements++;
          console.log(`    🔑 Replaced Brevo API key in header: ${key}`);
        }

        if (value.includes(OPENWEATHER_API_KEY_PLACEHOLDER)) {
          parsedHeaders[key] = value.replace(
            new RegExp(
              OPENWEATHER_API_KEY_PLACEHOLDER.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              ),
              "g"
            ),
            OPENWEATHER_API_KEY
          );
          totalReplacements++;
          console.log(`    🌤️ Replaced OpenWeather API key in header: ${key}`);
        }
      }
    }

    if (totalReplacements > 0) {
      console.log(`    ✅ Total API key replacements: ${totalReplacements}`);
    }

    // Handle POST/PUT/PATCH body data
    if (method !== "GET") {
      // Priority: Post-Data tag > Body tag > default
      let requestBody = postData || body || "";

      // Log which source is being used for the request body
      if (postData && postData.trim() !== "") {
        console.log(
          `    📝 Using Post-Data for request body (${postData.length} chars)`
        );
      } else if (body && body.trim() !== "") {
        console.log(
          `    📝 Using Body tag for request body (${body.length} chars)`
        );
      } else {
        console.log(`    📝 No request body found`);
      }

      if (requestBody) {
        // Check if headers indicate form data
        const contentType =
          parsedHeaders["Content-Type"] || parsedHeaders["content-type"];

        if (
          contentType &&
          contentType.includes("application/x-www-form-urlencoded")
        ) {
          // For form data, body should already be in the correct format
          config.data = requestBody;
          console.log(`Using form data body: ${requestBody}`);
        } else if (contentType && contentType.includes("application/json")) {
          // For JSON, try to parse and re-stringify to ensure valid JSON
          try {
            const parsedBody = JSON.parse(requestBody);
            config.data = parsedBody;
            console.log(`Using JSON body:`, parsedBody);
          } catch (e) {
            console.warn(
              "Failed to parse body as JSON, using raw body:",
              e.message
            );
            config.data = requestBody;
          }
        } else {
          // For other content types, use body as-is
          config.data = requestBody;
          console.log(`Using raw body: ${requestBody}`);
        }
      }
    }

    // Replace API keys in request body/data
    if (config.data && typeof config.data === "string") {
      if (config.data.includes(BREVO_API_KEY_PLACEHOLDER)) {
        config.data = config.data.replace(
          new RegExp(
            BREVO_API_KEY_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "g"
          ),
          BREVO_API_KEY
        );
        totalReplacements++;
        console.log("    🔑 Replaced Brevo API key in request body");
      }

      if (config.data.includes(OPENWEATHER_API_KEY_PLACEHOLDER)) {
        config.data = config.data.replace(
          new RegExp(
            OPENWEATHER_API_KEY_PLACEHOLDER.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            ),
            "g"
          ),
          OPENWEATHER_API_KEY
        );
        totalReplacements++;
        console.log("    🌤️ Replaced OpenWeather API key in request body");
      }
    }

    // Also check for API keys in JSON body objects
    if (config.data && typeof config.data === "object") {
      const dataStr = JSON.stringify(config.data);

      if (dataStr.includes(BREVO_API_KEY_PLACEHOLDER)) {
        config.data = JSON.parse(
          dataStr.replace(
            new RegExp(
              BREVO_API_KEY_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "g"
            ),
            BREVO_API_KEY
          )
        );
        totalReplacements++;
        console.log("    🔑 Replaced Brevo API key in JSON body object");
      }

      if (dataStr.includes(OPENWEATHER_API_KEY_PLACEHOLDER)) {
        config.data = JSON.parse(
          dataStr.replace(
            new RegExp(
              OPENWEATHER_API_KEY_PLACEHOLDER.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              ),
              "g"
            ),
            OPENWEATHER_API_KEY
          )
        );
        totalReplacements++;
        console.log("    🌤️ Replaced OpenWeather API key in JSON body object");
      }
    }

    // Special handling for different API types
    const isWeb3Form =
      parsedHeaders["Is-Web3-Form"] === "true" ||
      parsedHeaders["is-web3-form"] === "true";
    const isBrevoApi = config.url && config.url.includes("api.brevo.com");
    const isOpenWeatherApi =
      config.url && config.url.includes("api.openweathermap.org");

    // Add browser-like headers for Web3Forms to bypass 403 errors
    if (isWeb3Form) {
      console.log("Detected Web3Form request, adding browser-like headers");
      config.headers = {
        ...config.headers,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
        Origin: "https://web3forms.com",
        Referer: "https://web3forms.com/",
        "X-Requested-With": "XMLHttpRequest",
      };

      // Ensure we're using the correct endpoint and method for Web3Forms
      if (config.url.includes("web3forms.com")) {
        if (!config.url.endsWith("/submit")) {
          config.url = config.url.replace(/\/?$/, "") + "/submit";
          console.log(`Updated Web3Forms URL to: ${config.url}`);
        }
      }
    }

    // Special handling for Brevo API
    if (isBrevoApi) {
      console.log("🚀 Detected Brevo API request - using optimized settings");

      // Ensure the API key is set with the correct case for Brevo
      const apiKey =
        parsedHeaders["api-key"] ||
        parsedHeaders["Api-Key"] ||
        parsedHeaders["API-KEY"] ||
        parsedHeaders["apiKey"];
      if (apiKey) {
        console.log("✅ Brevo API key found in headers");
        config.headers["api-key"] = apiKey;
        console.log("🔧 Set api-key header with correct case for Brevo API");
      } else {
        console.log("❌ Brevo API key NOT found in headers!");
      }
    }

    console.log("Final axios config:", {
      method: config.method,
      url: config.url,
      headers: config.headers,
      hasData: !!config.data,
      dataType: typeof config.data,
      isWeb3Form: isWeb3Form || false,
      isBrevoApi: isBrevoApi || false,
    });

    // Make the HTTP request
    console.log(`    🚀 Making axios request...`);
    const response = await axios(config);
    console.log(`    ✅ Axios request completed successfully`);

    // Log response details prominently
    console.log(`    📡 Response: ${response.status} ${response.statusText}`);
    console.log(
      `    📊 Data: ${
        response.data
          ? typeof response.data === "string"
            ? response.data.length
            : JSON.stringify(response.data).length
          : 0
      } bytes`
    );

    // Always show status code prominently for non-200 responses
    if (response.status !== 200) {
      console.log(
        `    🚨 HTTP Status: ${response.status} - ${response.statusText}`
      );
    }

    // Special error handling for different API types
    if (isWeb3Form && response.status !== 200) {
      console.log("    🚨 Web3Forms error detected");
      if (response.status === 405) {
        console.log(
          "    💡 Try Web3Form-Strategy: alternative-endpoint or get-request"
        );
      }
    }

    if (isBrevoApi) {
      if (response.status !== 200) {
        if (response.status === 401) {
          console.log("    🚨 401 Unauthorized - check your Brevo API key");
        } else if (response.status === 400) {
          console.log(
            "    🚨 400 Bad Request - check email format and required fields"
          );
        } else if (response.status === 429) {
          console.log(
            "    🚨 429 Rate Limited - too many requests to Brevo API"
          );
        }
      } else {
        console.log("    ✅ Brevo email sent successfully!");
      }
    }

    if (isOpenWeatherApi) {
      if (response.status !== 200) {
        if (response.status === 401) {
          console.log(
            "    🚨 401 Unauthorized - check your OpenWeather API key"
          );
        } else if (response.status === 400) {
          console.log(
            "    🚨 400 Bad Request - check city name and parameters"
          );
        } else if (response.status === 429) {
          console.log(
            "    🚨 429 Rate Limited - too many requests to OpenWeather API"
          );
        } else if (response.status === 404) {
          console.log("    🚨 404 Not Found - city or location not found");
        }
      } else {
        console.log("    ✅ OpenWeather data retrieved successfully!");
      }
    }

    // Determine success based on HTTP status code
    const isSuccess = response.status >= 200 && response.status < 300;

    // Log any non-success responses prominently
    if (!isSuccess) {
      console.log(
        `    ⚠️ HTTP Error: ${response.status} ${response.statusText}`
      );
      console.log(`    🔍 URL: ${config.url}`);
      console.log(`    📋 Method: ${config.method}`);
      if (response.data) {
        const errorData =
          typeof response.data === "string"
            ? response.data.substring(0, 200)
            : JSON.stringify(response.data);
        console.log(
          `    📝 Error: ${errorData}${errorData.length >= 200 ? "..." : ""}`
        );
      }
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      success: isSuccess,
      error: isSuccess
        ? null
        : `HTTP ${response.status}: ${response.statusText}`,
      code: isSuccess ? null : response.status,
    };
  } catch (error) {
    console.log(`    ❌ HTTP Request Failed: ${error.message}`);
    if (error.response) {
      console.log(
        `    📡 Error Response: ${error.response.status} ${error.response.statusText}`
      );
      console.log(`    📝 Error Data: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.log(
        `    🌐 Network Error: Request was made but no response received`
      );
    } else {
      console.log(`    🔧 Axios Error: ${error.message}`);
    }

    return {
      success: false,
      error: error.message,
      code: error.code || "NETWORK_ERROR",
    };
  }
}

// ============================================================================
// AO INITIALIZATION
// ============================================================================

/**
 * Initialize aoconnect with wallet from specified path
 */
async function initializeAO() {
  try {
    // Get wallet path from environment variable with fallback
    const walletPath = process.env.AO_WALLET_PATH || "~/.aos.json";

    // Expand ~ to home directory if present
    const expandedWalletPath = walletPath.startsWith("~")
      ? walletPath.replace(
          "~",
          process.env.HOME || process.env.USERPROFILE || ""
        )
      : walletPath;

    console.log(`Loading Arweave wallet from: ${expandedWalletPath}`);

    const wallet = JSON.parse(fs.readFileSync(expandedWalletPath, "utf8"));

    console.log("Creating data item signer...");
    const signer = createDataItemSigner(wallet);

    console.log("Connecting to AO...");
    const { message, result, results, spawn, monitor, unmonitor, dryrun } =
      connect({
        MU_URL: process.env.MU_URL || "https://mu.ao-testnet.xyz",
        CU_URL: process.env.CU_URL || "https://cu.ao-testnet.xyz",
        GATEWAY_URL: process.env.GATEWAY_URL || "https://arweave.net",
      });

    return { message, signer };
  } catch (error) {
    console.error("Failed to initialize AO:", error);
    throw error;
  }
}

// ============================================================================
// RESPONSE SENDING
// ============================================================================

/**
 * Send response back to mock relay process with optimization for large responses
 * Handles both single messages and chunked responses for large data
 */
async function sendResponseToProcess(
  message,
  signer,
  requestId,
  axiosResponse,
  targetProcessId,
  customTags = []
) {
  try {
    // Check if this is an error response (even if status is 200)
    const isErrorResponse = detectErrorResponse(axiosResponse);

    if (isErrorResponse || !axiosResponse.success) {
      // Send error response as single message
      console.log(
        isErrorResponse
          ? "Sending error response (detected error content)"
          : "Sending error message"
      );

      const messageData = isErrorResponse
        ? JSON.stringify({
            success: false,
            error: "Error response detected",
            code: axiosResponse.status,
            originalStatus: axiosResponse.status,
            isErrorResponse: true,
          })
        : JSON.stringify(axiosResponse);

      // Add custom tags to error response
      const errorTags = [
        { name: "Action", value: "axios-response" },
        { name: "RequestId", value: requestId.toString() },
        { name: "Status", value: "Error" },
        { name: "Requestor", value: targetProcessId },
        { name: "IsErrorResponse", value: isErrorResponse ? "true" : "false" },
      ];

      // Add custom tags
      errorTags.push(...customTags);

      const result = await message({
        process: MOCK_RELAY_PROCESS_ID,
        data: messageData,
        tags: errorTags,
        signer: signer,
      });
      return result;
    }

    // For success responses, try to optimize and fit in single message
    const maxDataSize = 9 * 1024 * 1024; // 9MB to stay under 10MB total limit
    let optimizedResponse = axiosResponse;

    // Filter out API keys from response data before processing
    if (optimizedResponse.data && typeof optimizedResponse.data === "string") {
      optimizedResponse.data = filterApiKeyFromResponse(optimizedResponse.data);
    }

    // Also filter API keys from headers if they exist
    if (optimizedResponse.headers) {
      for (const [key, value] of Object.entries(optimizedResponse.headers)) {
        if (typeof value === "string") {
          optimizedResponse.headers[key] = filterApiKeyFromResponse(value);
        }
      }
    }

    let responseData = JSON.stringify(optimizedResponse);

    // If response is too large, try to optimize by removing less important data
    if (responseData.length > maxDataSize) {
      console.log(
        `Response too large (${responseData.length} bytes), attempting optimization...`
      );

      // Try removing headers first (usually not critical for end users)
      if (optimizedResponse.headers) {
        const optimizedWithoutHeaders = { ...optimizedResponse };
        delete optimizedWithoutHeaders.headers;
        const withoutHeadersData = JSON.stringify(optimizedWithoutHeaders);

        if (withoutHeadersData.length <= maxDataSize) {
          console.log(
            `Optimization successful: removed headers, size: ${withoutHeadersData.length} bytes`
          );
          optimizedResponse = optimizedWithoutHeaders;
          responseData = withoutHeadersData;
        } else {
          console.log(
            `Removing headers not enough, size still: ${withoutHeadersData.length} bytes`
          );
        }
      }

      // If still too large, try removing statusText (less critical)
      if (responseData.length > maxDataSize && optimizedResponse.statusText) {
        const optimizedWithoutStatusText = { ...optimizedResponse };
        delete optimizedWithoutStatusText.statusText;
        const withoutStatusTextData = JSON.stringify(
          optimizedWithoutStatusText
        );

        if (withoutStatusTextData.length <= maxDataSize) {
          console.log(
            `Optimization successful: removed statusText, size: ${withoutStatusTextData.length} bytes`
          );
          optimizedResponse = optimizedWithoutStatusText;
          responseData = withoutStatusTextData;
        } else {
          console.log(
            `Removing statusText not enough, size still: ${withoutStatusTextData.length} bytes`
          );
        }
      }
    }

    // If we can fit the optimized response in a single message, do it
    if (responseData.length <= maxDataSize) {
      console.log(
        `Sending optimized response as single message (${responseData.length} bytes)`
      );

      // Add custom tags to success response
      const successTags = [
        { name: "Action", value: "axios-response" },
        { name: "RequestId", value: requestId.toString() },
        { name: "Status", value: "Success" },
        { name: "Requestor", value: targetProcessId },
        { name: "Optimized", value: "true" },
      ];

      // Add custom tags
      successTags.push(...customTags);

      const result = await message({
        process: MOCK_RELAY_PROCESS_ID,
        data: responseData,
        tags: successTags,
        signer: signer,
      });
      return result;
    }

    // Last resort: chunk the response (only if > 9MB)
    console.log(
      `Response too large even after optimization (${responseData.length} bytes), chunking into parts`
    );

    const maxChunkSize = 6 * 1024 * 1024; // 6MB chunks to stay well under limits
    const chunks = [];
    for (let i = 0; i < responseData.length; i += maxChunkSize) {
      chunks.push(responseData.slice(i, i + maxChunkSize));
    }

    const chunkMessageId = `chunk_${requestId}_${Date.now()}`;
    const results = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        const isLastChunk = i === chunks.length - 1;
        const chunkTags = [
          { name: "Action", value: "axios-response-chunk" },
          { name: "RequestId", value: requestId.toString() },
          { name: "Status", value: "Success" },
          { name: "Requestor", value: targetProcessId },
          { name: "ChunkMessageId", value: chunkMessageId },
          { name: "ChunkIndex", value: i.toString() },
          { name: "TotalChunks", value: chunks.length.toString() },
          { name: "IsLastChunk", value: isLastChunk ? "true" : "false" },
        ];

        // Filter API keys from chunk data before sending
        const filteredChunkData = filterApiKeyFromResponse(chunks[i]);

        // Add custom tags to each chunk
        if (customTags && customTags.length > 0) {
          chunkTags.push(...customTags);
          console.log(
            `Added ${customTags.length} custom tags to chunk ${i + 1}`
          );
        }

        // Validate all tags have valid values
        for (const tag of chunkTags) {
          if (tag.value === undefined || tag.value === null) {
            console.error(`Invalid tag value for ${tag.name}: ${tag.value}`);
            throw new Error(`Invalid tag value for ${tag.name}`);
          }
        }

        console.log(
          `Sending chunk ${i + 1}/${chunks.length} (${
            filteredChunkData.length
          } bytes) with ID: ${chunkMessageId}`
        );
        console.log(`Chunk tags:`, chunkTags);

        const result = await message({
          process: MOCK_RELAY_PROCESS_ID,
          data: filteredChunkData,
          tags: chunkTags,
          signer: signer,
        });

        results.push(result);
      }

      return results[0];
    } catch (chunkError) {
      console.error(`Error during chunked response sending:`, chunkError);
      throw new Error(`Chunked response failed: ${chunkError.message}`);
    }
  } catch (error) {
    console.error("Error sending response to process:", error);
    throw error;
  }
}

// ============================================================================
// GRAPHQL AND DATA FETCHING
// ============================================================================

/**
 * Generate GraphQL query with current environment variable values
 * This ensures the query uses the actual loaded values at runtime
 */
function getSuccessMessagesQuery() {
  return `
  query {
    transactions(
      tags: [
        { name: "From-Process", values: ["${MOCK_RELAY_PROCESS_ID}"] }
        { name: "Action", values: ["Relay-Response"] }
        { name: "Status", values: ["Success"] }
        { name: "Data-Protocol", values: ["ao"] }
      ]
      first: 100
      sort: HEIGHT_DESC
    ) {
      edges {
        node {
          id
          block {
            height
            timestamp
          }
          data {
            size
          }
          tags {
            name
            value
          }
        }
      }
    }
  }
`;
}

/**
 * Fetch transaction data from Arweave using https module
 */
async function fetchTransactionData(txId) {
  try {
    console.log(
      `    📥 Fetching transaction data for ${txId.substring(0, 8)}...`
    );

    // Use https module instead of fetch
    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: "arweave.net",
        port: 443,
        path: `/${txId}`,
        method: "GET",
        family: 4, // Force IPv4
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AO-Relay-Monitor/1.0)",
          Connection: "close",
        },
      };

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData,
          });
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.setTimeout(15000);
      req.end();
    });

    // Handle redirects (302 status codes are common with Arweave)
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.location;
      if (location) {
        console.log(`    🔄 Following redirect to: ${location}`);

        // Follow the redirect
        const redirectResponse = await new Promise((resolve, reject) => {
          const redirectUrl = new URL(location);
          const redirectOptions = {
            hostname: redirectUrl.hostname,
            port: redirectUrl.port || 443,
            path: redirectUrl.pathname + redirectUrl.search,
            method: "GET",
            family: 4,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; AO-Relay-Monitor/1.0)",
              Connection: "close",
            },
          };

          const redirectReq = https.request(redirectOptions, (res) => {
            let redirectData = "";
            res.on("data", (chunk) => {
              redirectData += chunk;
            });
            res.on("end", () => {
              resolve({
                status: res.statusCode,
                data: redirectData,
              });
            });
          });

          redirectReq.on("error", (error) => {
            reject(error);
          });

          redirectReq.on("timeout", () => {
            redirectReq.destroy();
            reject(new Error("Redirect request timeout"));
          });

          redirectReq.setTimeout(15000);
          redirectReq.end();
        });

        if (redirectResponse.status !== 200) {
          throw new Error(
            `Redirect failed with status: ${redirectResponse.status}`
          );
        }

        console.log(
          `    ✅ Fetched ${redirectResponse.data.length} chars from transaction data (via redirect)`
        );
        return redirectResponse.data;
      } else {
        throw new Error("Redirect response missing Location header");
      }
    }

    if (response.status !== 200) {
      throw new Error(`Failed to fetch transaction data: ${response.status}`);
    }

    console.log(
      `    ✅ Fetched ${response.data.length} chars from transaction data`
    );
    return response.data;
  } catch (error) {
    console.log(`    ❌ Failed to fetch transaction data: ${error.message}`);
    return null;
  }
}

/**
 * Execute GraphQL query with fallback - Goldsky as primary, Arweave.net as fallback
 */
async function executeGraphQLQuery(query, variables = {}) {
  // Helper function to make HTTPS requests
  function makeHttpsRequest(url, data) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: "POST",
        family: 4, // Force IPv4
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; AO-Relay-Monitor/1.0)",
          "Content-Length": Buffer.byteLength(data),
          Connection: "close", // Don't keep connection alive
        },
      };

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData,
          });
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.setTimeout(15000);
      req.write(data);
      req.end();
    });
  }

  // Try Goldsky first (faster)
  try {
    console.log("    🔍 Trying Goldsky GraphQL endpoint (primary)...");
    const requestData = JSON.stringify({ query, variables });
    console.log(`    📤 Query: ${query.substring(0, 100)}...`);
    console.log(`    📤 Variables: ${JSON.stringify(variables)}`);
    const response = await makeHttpsRequest(
      GOLDSKY_PRIMARY_ENDPOINT,
      requestData
    );

    if (response.status !== 200) {
      throw new Error(`Goldsky GraphQL request failed: ${response.status}`);
    }

    const data = JSON.parse(response.data);

    if (data.errors) {
      throw new Error(`Goldsky GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    console.log("    ✅ Goldsky query successful");
    console.log(
      `    📥 Response data: ${JSON.stringify(data).substring(0, 200)}...`
    );
    return data;
  } catch (goldskyError) {
    console.log(`    ⚠️ Goldsky failed: ${goldskyError.message}`);
    console.log("    🔄 Falling back to Arweave.net...");

    // Fallback to Arweave.net
    try {
      const requestData = JSON.stringify({ query, variables });
      const fallbackResponse = await makeHttpsRequest(
        ARWEAVE_FALLBACK_ENDPOINT,
        requestData
      );

      if (fallbackResponse.status !== 200) {
        throw new Error(
          `Arweave.net GraphQL request failed: ${fallbackResponse.status}`
        );
      }

      const fallbackData = JSON.parse(fallbackResponse.data);

      if (fallbackData.errors) {
        throw new Error(
          `Arweave.net GraphQL errors: ${JSON.stringify(fallbackData.errors)}`
        );
      }

      console.log("    ✅ Arweave.net fallback successful");
      return fallbackData;
    } catch (fallbackError) {
      throw new Error(
        `Both GraphQL endpoints failed. Goldsky: ${goldskyError.message}, Arweave: ${fallbackError.message}`
      );
    }
  }
}

// ============================================================================
// MAIN MONITORING FUNCTIONS
// ============================================================================

/**
 * Check for new success messages from the relay process
 * Processes relay requests and sends responses back to AO processes
 */
async function checkForNewMessages(db, message, signer) {
  try {
    console.log(
      `\n🔍 [${new Date().toISOString()}] Checking for new messages...`
    );

    // Skip GraphQL if we've had too many consecutive failures (circuit breaker)
    if (consecutiveGraphQLFailures >= MAX_GRAPHQL_FAILURES) {
      console.log(
        `⚠️ Skipping GraphQL check due to ${consecutiveGraphQLFailures} consecutive failures`
      );
      console.log(
        `💡 Will retry GraphQL in ${GRAPHQL_FAILURE_DELAY / 60000} minutes`
      );

      // Reset failure count after delay
      setTimeout(() => {
        console.log("🔄 Resetting GraphQL failure count, will retry...");
        consecutiveGraphQLFailures = 0;
      }, GRAPHQL_FAILURE_DELAY);

      return;
    }

    const query = getSuccessMessagesQuery();
    console.log(
      `    🔍 Executing GraphQL query for process: ${MOCK_RELAY_PROCESS_ID}`
    );

    // First, let's check if there are ANY transactions from this process
    const broadQuery = `
      query {
        transactions(
          tags: [
            { name: "From-Process", values: ["${MOCK_RELAY_PROCESS_ID}"] }
          ]
          first: 10
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;

    console.log("    🔍 Checking for ANY transactions from this process...");
    const broadData = await executeGraphQLQuery(broadQuery);

    if (broadData.data.transactions.edges.length > 0) {
      console.log(
        `    📊 Found ${broadData.data.transactions.edges.length} transactions from process`
      );
      console.log("    📋 Sample transaction tags:");
      broadData.data.transactions.edges.slice(0, 3).forEach((edge, i) => {
        console.log(`       Transaction ${i + 1}:`);
        edge.node.tags.forEach((tag) => {
          console.log(`         ${tag.name}: ${tag.value}`);
        });
      });
    } else {
      console.log("    ❌ No transactions found from this process at all");
    }

    // Now run the original specific query
    const data = await executeGraphQLQuery(query);

    // Also check if there are ANY transactions with the tags we're looking for
    const tagCheckQuery = `
      query {
        transactions(
          tags: [
            { name: "Action", values: ["Relay-Response"] }
            { name: "Status", values: ["Success"] }
            { name: "Data-Protocol", values: ["ao"] }
          ]
          first: 5
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;

    console.log(
      "    🔍 Checking for ANY transactions with Relay-Response tags..."
    );
    const tagCheckData = await executeGraphQLQuery(tagCheckQuery);

    if (tagCheckData.data.transactions.edges.length > 0) {
      console.log(
        `    📊 Found ${tagCheckData.data.transactions.edges.length} transactions with Relay-Response tags`
      );
      console.log("    📋 Sample transaction tags:");
      tagCheckData.data.transactions.edges.slice(0, 3).forEach((edge, i) => {
        console.log(`       Transaction ${i + 1}:`);
        edge.node.tags.forEach((tag) => {
          console.log(`         ${tag.name}: ${tag.value}`);
        });
      });
    } else {
      console.log("    ❌ No transactions found with Relay-Response tags");
    }

    // Reset failure count on success
    if (consecutiveGraphQLFailures > 0) {
      console.log("✅ GraphQL connection restored!");
      consecutiveGraphQLFailures = 0;
    }

    const transactions = data.data.transactions.edges;
    console.log(`Found ${transactions.length} transactions from GraphQL query`);

    // Count how many match our criteria and find the most recent
    let matchingTransactions = 0;
    let mostRecentTx = null;
    let mostRecentTags = null;

    for (const edge of transactions) {
      const tx = edge.node;
      const tags = extractTags(tx.tags);
      if (
        tags.Action === "Relay-Response" &&
        tags.Status === "Success" &&
        tags.URL &&
        tags.Method
      ) {
        matchingTransactions++;
        if (!mostRecentTx || tx.block.height > mostRecentTx.block.height) {
          mostRecentTx = tx;
          mostRecentTags = tags;
        }
      }
    }
    console.log(
      `📊 ${matchingTransactions} transactions match relay criteria (Action=Relay-Response, Status=Success)`
    );

    // Show only the most recent transaction info (unless it needs processing)
    if (mostRecentTx && mostRecentTags) {
      const requestTxid = mostRecentTags.Reference;
      if (requestTxid) {
        const alreadyProcessed = await isRequestProcessed(db, requestTxid);
        if (alreadyProcessed) {
          console.log(
            `📋 Most recent: ${mostRecentTx.id.substring(
              0,
              8
            )}... (already processed)`
          );
        } else {
          console.log(
            `🆕 Most recent: ${mostRecentTx.id.substring(
              0,
              8
            )}... (NEW - will process)`
          );
        }
      } else {
        console.log(
          `📋 Most recent: ${mostRecentTx.id.substring(
            0,
            8
          )}... (no Reference tag)`
        );
      }
    }

    // Process each transaction
    for (const edge of transactions) {
      const tx = edge.node;
      const tags = extractTags(tx.tags);

      // Check if this is a success message with required tags (filtered locally)
      if (
        tags.Action === "Relay-Response" &&
        tags.Status === "Success" &&
        tags.URL &&
        tags.Method
      ) {
        // Check if we've already processed this request
        const requestTxid = tags.Reference;
        if (!requestTxid) {
          console.log(
            `    ⚠️ Skipping response without Reference tag: ${tx.id.substring(
              0,
              8
            )}...`
          );
          continue;
        }

        const alreadyProcessed = await isRequestProcessed(db, requestTxid);
        if (alreadyProcessed) {
          continue; // Skip already processed transactions silently
        }

        console.log(`\n🆕 Processing new request: ${tx.id.substring(0, 8)}...`);
        console.log(`  URL: ${tags.URL}`);
        console.log(`  Method: ${tags.Method}`);

        // Check if this is a Gus price API request
        if (isGusPriceRequest(tags.URL)) {
          console.log(`  🪙 Gus price API request detected`);
          console.log(`  🔑 Will validate HighFive bearer token`);
        }

        // Declare requestId at the beginning so it's available in error handling
        let requestId;

        try {
          // Check for Web3Form tag
          let parsedHeaders = {};
          try {
            parsedHeaders = JSON.parse(tags.Headers || "{}");
          } catch (e) {
            parsedHeaders = {};
          }

          const isWeb3Form =
            parsedHeaders["Is-Web3-Form"] === "true" ||
            parsedHeaders["is-web3-form"] === "true";

          if (isWeb3Form) {
            console.log(
              "🚀 Web3Form request detected - will bypass 403 restrictions"
            );
          }

          // Check for Gus price API denomination
          if (isGusPriceRequest(tags.URL)) {
            const denomination = parsedHeaders["X-Denomination"] || "12";
            console.log(`  🪙 Gus price API denomination: ${denomination}`);
            console.log(
              `  🪙 Token ID will be extracted from URL: ${tags.URL}`
            );
          }

          // Record the request
          try {
            requestId = await recordRequest(db, requestTxid, tags);
            console.log(`  Database ID: ${requestId}`);
          } catch (dbError) {
            if (
              dbError.code === "SQLITE_CONSTRAINT" &&
              dbError.message.includes("UNIQUE constraint failed")
            ) {
              console.log(
                `    ⚠️ Request ${requestTxid} already exists in database, skipping...`
              );
              continue;
            } else {
              throw dbError;
            }
          }

          // Make the HTTP request
          console.log(`  Making HTTP request...`);

          // Check if body content is in the Data field (for large content)
          let requestBody = "";
          let bodySource = "none";

          if (tags["Post-Data"] && tags["Post-Data"].trim() !== "") {
            requestBody = tags["Post-Data"];
            bodySource = "Post-Data";
          } else if (tags.Body && tags.Body.trim() !== "") {
            requestBody = tags.Body;
            bodySource = "Body";
          } else if (
            tags["Body-Source"] === "Data-Field" &&
            tx.data &&
            tx.data.size > 0
          ) {
            // Large content is in the Data field, fetch it from Arweave
            console.log(
              `    📝 Large content detected in Data field (${tx.data.size} bytes)`
            );
            console.log(`    📥 Fetching content from transaction data...`);
            const transactionData = await fetchTransactionData(tx.id);
            if (transactionData) {
              requestBody = transactionData;
              bodySource = "Data-Field";
              console.log(
                `    ✅ Successfully fetched ${transactionData.length} chars from Data field`
              );
            } else {
              console.log(
                `    ❌ Failed to fetch transaction data, request will fail`
              );
            }
          }

          if (bodySource !== "none") {
            console.log(
              `    📝 Using ${bodySource} for request body (${requestBody.length} chars)`
            );
          }

          // If we need body content but couldn't get it, skip this request
          if (
            tags.Method !== "GET" &&
            bodySource === "Data-Field" &&
            !requestBody
          ) {
            console.log(
              `    ❌ Cannot proceed without body content for ${tags.Method} request`
            );
            continue;
          }

          const axiosResponse = await makeHttpRequest(
            tags.URL,
            tags.Method,
            tags.Headers,
            requestBody,
            tags.Timeout,
            tags["Post-Data"] // Pass Post-Data as additional parameter
          );
          console.log(
            `  HTTP request completed. Success: ${axiosResponse.success}`
          );

          // Send response back to the process
          console.log(`  Sending response back to AO process...`);

          // Extract the target process ID from the success message
          const targetProcessId = tags.Requestor;
          if (!targetProcessId) {
            console.error("Error: No Requestor tag found in success message");
            continue;
          }

          console.log(`  Target: ${targetProcessId.substring(0, 8)}...`);

          // Collect X- prefixed custom tags from the success message
          const customTags = [];
          for (const [tagName, tagValue] of Object.entries(tags)) {
            if (tagName.startsWith("X-")) {
              customTags.push({ name: tagName, value: tagValue });
              console.log(`    Custom tag: ${tagName} = ${tagValue}`);
            }
          }

          // Check for Post-Data tag (for POST requests)
          const hasPostData =
            tags["Post-Data"] && tags["Post-Data"].trim() !== "";
          if (hasPostData) {
            console.log("    Post-Data found for POST request body");
          }

          try {
            const responseResult = await sendResponseToProcess(
              message,
              signer,
              requestId,
              axiosResponse,
              targetProcessId,
              customTags
            );
            console.log(
              `    📤 Response sent to mock relay: ${responseResult}`
            );
            console.log(`    💾 Storing message ID in database...`);

            // Update database with response
            await updateRequestWithResponse(
              db,
              requestId,
              responseResult,
              axiosResponse
            );
            console.log(
              `    ✅ Database updated with message ID: ${responseResult}`
            );

            console.log(`  ✅ Request processed successfully`);
          } catch (sendError) {
            console.error(
              `Failed to send response to mock relay process:`,
              sendError
            );

            // Send failure notification to the mock relay process
            try {
              const failureMessage = await message({
                process: MOCK_RELAY_PROCESS_ID,
                data: JSON.stringify({
                  success: false,
                  error: "Failed to send response to mock relay process",
                  originalError: sendError.message,
                  requestId: requestId,
                  targetProcessId: targetProcessId,
                }),
                tags: [
                  { name: "Action", value: "axios-response" },
                  { name: "RequestId", value: requestId.toString() },
                  { name: "Status", value: "Error" },
                  { name: "Requestor", value: targetProcessId },
                  { name: "IsErrorResponse", value: "true" },
                  { name: "ErrorType", value: "SendFailure" },
                ],
                signer: signer,
              });

              console.log(
                `    📤 Failure notification sent to mock relay: ${failureMessage}`
              );
              console.log(`    💾 Storing failure message ID in database...`);

              // Update database with the failure
              await updateRequestWithResponse(db, requestId, failureMessage, {
                success: false,
                error: `Send failure: ${sendError.message}`,
              });
              console.log(
                `    ✅ Database updated with failure message ID: ${failureMessage}`
              );
            } catch (failureSendError) {
              console.error(
                `Failed to send failure notification:`,
                failureSendError
              );

              // Last resort: just update database
              try {
                console.log(
                  `    💾 Storing error in database (no message ID available)...`
                );
                await updateRequestWithResponse(db, requestId, null, {
                  success: false,
                  error: `Send failure: ${sendError.message}. Failed to notify: ${failureSendError.message}`,
                });
                console.log(`    ✅ Database updated with error details`);
              } catch (dbError) {
                console.error(
                  `    ❌ Failed to update database with error:`,
                  dbError
                );
              }
            }
          }
        } catch (error) {
          console.error(`Error processing request ${tx.id}:`, error);

          // Record the error in database if we have a requestId
          if (requestId) {
            try {
              await updateRequestWithResponse(db, requestId, null, {
                success: false,
                error: error.message,
              });
            } catch (dbError) {
              console.error(`Failed to update database with error:`, dbError);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking for messages:", error);

    // Track GraphQL failures
    if (
      error.message.includes("timeout") ||
      error.message.includes("GraphQL")
    ) {
      consecutiveGraphQLFailures++;
      console.log(
        `📊 GraphQL failure count: ${consecutiveGraphQLFailures}/${MAX_GRAPHQL_FAILURES}`
      );

      if (consecutiveGraphQLFailures >= MAX_GRAPHQL_FAILURES) {
        console.log("🚨 Too many GraphQL failures, entering fallback mode");
      }
    }
  }
}

/**
 * Main monitoring function - initializes everything and starts the monitoring loop
 */
async function monitorRelayProcess() {
  let db;
  let message;
  let signer;
  let cronMonitor = null;

  try {
    // Validate environment variables first
    validateEnvironment();

    // Initialize database
    db = await initializeDatabase();

    // Initialize AO with wallet
    const aoInit = await initializeAO();
    message = aoInit.message;
    signer = aoInit.signer;

    console.log("Starting relay process monitor...");
    console.log(`Monitoring process: ${MOCK_RELAY_PROCESS_ID}`);
    console.log(`Check interval: ${CHECK_INTERVAL / 1000} seconds`);

    // Start monitoring the crontroller process to keep it ticking
    console.log(`Starting cron monitor for: ${CRONTROLLER_PROCESS_ID}`);
    try {
      cronMonitor = await monitor({
        process: CRONTROLLER_PROCESS_ID,
        signer: signer,
      });
      globalCronMonitor = cronMonitor; // Store in global variable for shutdown handlers
      console.log(
        `✅ Cron monitor started successfully for crontroller process`
      );
    } catch (cronError) {
      console.warn(`⚠️ Failed to start cron monitor: ${cronError.message}`);
      console.log(`   Cron functionality may not work properly`);
    }

    // Start monitoring loop
    setInterval(async () => {
      try {
        await checkForNewMessages(db, message, signer);
      } catch (error) {
        console.error("Error in monitoring loop:", error);

        // If it's a GraphQL timeout, wait longer before next attempt
        if (
          error.message.includes("timeout") ||
          error.message.includes("GraphQL")
        ) {
          console.log(
            "    💡 GraphQL issue detected, extending next check interval..."
          );
          // Don't fail completely, just log and continue
        }
      }
    }, CHECK_INTERVAL);

    // Initial check
    await checkForNewMessages(db, message, signer);
  } catch (error) {
    console.error("Failed to initialize monitor:", error);
    process.exit(1);
  }
}

// ============================================================================
// SHUTDOWN HANDLERS
// ============================================================================

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");

  // Stop the cron monitor if it's running
  if (globalCronMonitor) {
    try {
      console.log("Stopping cron monitor...");
      await unmonitor({
        process: CRONTROLLER_PROCESS_ID,
        signer: globalCronMonitor.signer || null,
      });
      console.log("✅ Cron monitor stopped successfully");
    } catch (error) {
      console.warn("⚠️ Failed to stop cron monitor:", error.message);
    }
  }

  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");

  // Stop the cron monitor if it's running
  if (globalCronMonitor) {
    try {
      console.log("Stopping cron monitor...");
      await unmonitor({
        process: CRONTROLLER_PROCESS_ID,
        signer: globalCronMonitor.signer || null,
      });
      console.log("✅ Cron monitor stopped successfully");
    } catch (error) {
      console.warn("⚠️ Failed to stop cron monitor:", error.message);
    }
  }

  process.exit(0);
});

// ============================================================================
// MODULE EXPORTS AND STARTUP
// ============================================================================

// Start the monitor if this file is run directly
if (require.main === module) {
  monitorRelayProcess().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

// Export functions for use in other modules
module.exports = {
  monitorRelayProcess,
  checkForNewMessages,
  makeHttpRequest,
  sendResponseToProcess,
  // Gus price API functions
  fetchTokenPrice,
  isGusPriceRequest,
  extractTokenIdFromGusUrl,
  validateHighFiveAuth,
};
