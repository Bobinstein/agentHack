local json = require("json")


Tokens = Tokens or {
    ["AO"] = {
        ["TokenId"] = "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc",
        ["Price-Fetching-Method"] = "URL",
        ["Price-URL"] =
        "https://api.coingecko.com/api/v3/coins/${ticker}/market_chart?vs_currency=usd&days=365&interval=daily",
        ["Price-Source"] = "coingecko",
        ["Price-Ticker"] = "ao-computer",
        ["Denomination"] = "12",
    },
    ["PI"] = {
        ["TokenId"] = "4hXj_E-5fAKmo4E8KjgQvuDJKAFk9P2grhycVmISDLs",
        ["MintProcess"] = "rxxU4g-7tUHGvF28W2l53hxarpbaFR4NaSnOaxx6MIE",
        ["Price-Fetching-Method"] = "URL",
        ["Price-URL"] =
        "https://GusHasTheBestPrices.com/api/v69/price/${tokenId}",
        ["Price-Source"] = "GUSCustom",
        ["Denomination"] = "12",
    }
}

FetchPriceCalls = FetchPriceCalls or {

    ["coingecko"] = {
        ["method"] = "GET",
        ["url"] = "https://api.coingecko.com/api/v3/coins/${ticker}/market_chart",
        ["params"] = {
            ["vs_currency"] = "usd",
            ["days"] = "1",
        },
        ["headers"] = {
            ["Accept"] = "application/json",
            ["User-Agent"] = "AO-Agent/1.0"
        },
        ["expectedResponse"] = {
            ["prices"] = "array of [timestamp, price] pairs",
            ["market_caps"] = "array of [timestamp, market_cap] pairs",
            ["total_volumes"] = "array of [timestamp, volume] pairs"
        },
        ["responseFormat"] = "json",
        ["timeout"] = 30000
    },
    ["GUSCustom"] = {
        ["method"] = "GET",
        ["url"] = "https://GusHasTheBestPrices.com/api/v69/price/${tokenId}",
        ["params"] = {},
        ["headers"] = { ['Authorization'] = "Bearer HighFive" },
        ["expectedResponse"] = { "string" },
    }
}


TokenPrices = TokenPrices or {}

TokenBalances = TokenBalances or {}

TokenPortfolio = TokenPortfolio or {}

-- Authorization function
local function isAuthorized(msg)
    return msg.From == Owner or msg.From == CrontrollerProcessId
end

-- Handler to fetch prices for all tokens
Handlers.add(
    "cron-fetch-all-token-prices",
    Handlers.utils.hasMatchingTag("Action", "cron-fetch-all-token-prices"),
    function(msg)
        -- Check authorization
        if not isAuthorized(msg) then
            ao.send({
                Target = msg.From,
                Action = "Error",
                Data = "Unauthorized: Only owner or authorized processes can fetch token prices"
            })
            return
        end

        print("🔄 Starting price fetch for all tokens...")
        local fetchResults = {}
        local fetchCount = 0

        -- Iterate through all configured tokens
        for ticker, tokenConfig in pairs(Tokens) do
            local priceSource = tokenConfig["Price-Source"]

            -- Check if we have a fetch configuration for this price source
            if priceSource and FetchPriceCalls[priceSource] then
                local fetchConfig = FetchPriceCalls[priceSource]
                local priceTicker = tokenConfig["Price-Ticker"] or ticker

                print("📊 Fetching price for " .. ticker .. " using " .. priceSource .. " source")

                -- Build the relay request based on the fetch configuration
                local baseUrl = string.gsub(fetchConfig.url, "${ticker}", priceTicker):gsub("${tokenId}",
                    tokenConfig["TokenId"])

                -- Append query parameters for GET requests
                local fullUrl = baseUrl
                if fetchConfig.method == "GET" and fetchConfig.params then
                    local queryParams = {}
                    for key, value in pairs(fetchConfig.params) do
                        table.insert(queryParams, key .. "=" .. tostring(value))
                    end
                    if #queryParams > 0 then
                        fullUrl = baseUrl .. "?" .. table.concat(queryParams, "&")
                    end
                end

                local relayRequest = {
                    Target = "L7ZEASGMlsjY2AMpTwbX178slBpaHJJxznWN8oywiZY",
                    Action = "Relay-Request",
                    ["Request-URL"] = fullUrl,
                    Method = fetchConfig.method,
                    Headers = json.encode(fetchConfig.headers),
                    Timeout = tostring(fetchConfig.timeout or 30000),
                    Tags = {
                        ["X-Request-Type"] = "token-price-fetch",
                        ["X-Token-Ticker"] = ticker,
                        ["X-Token-Id"] = tokenConfig["TokenId"],
                        ["X-Price-Source"] = priceSource,
                        ["X-Requestor"] = msg.From,
                        ["X-Timestamp"] = tostring(os.time()),
                        ["X-Denomination"] = tokenConfig["Denomination"]
                    }
                }

                -- Send the relay request
                ao.send(relayRequest)
                fetchCount = fetchCount + 1

                -- Store the request info for tracking
                fetchResults[ticker] = {
                    source = priceSource,
                    timestamp = os.time(),
                    status = "requested"
                }

                print("📤 Sent price fetch request for " .. ticker .. " to " .. priceSource)
            else
                print("⚠️  No fetch configuration found for " .. ticker .. " with source: " .. tostring(priceSource))
                fetchResults[ticker] = {
                    source = priceSource,
                    timestamp = os.time(),
                    status = "no_config"
                }
            end
        end

        -- Count total tokens manually since #Tokens doesn't work for hash tables
        local totalTokenCount = 0
        for _ in pairs(Tokens) do
            totalTokenCount = totalTokenCount + 1
        end

        -- Send summary response
        ao.send({
            Target = msg.From,
            Action = "Price-Fetch-Initiated",
            Data = json.encode({
                message = "Price fetch initiated for " .. fetchCount .. " tokens",
                totalTokens = totalTokenCount,
                fetchResults = fetchResults,
                timestamp = os.time()
            })
        })

        print("✅ Price fetch initiated for " .. fetchCount .. " out of " .. totalTokenCount .. " tokens")
    end
)

-- Global function to process token price fetch responses
function processTokenPriceResponse(msg)
    print("💰 Processing token price fetch response")

    -- Extract metadata from tags
    local tokenTicker = msg.Tags["X-Token-Ticker"]
    local priceSource = msg.Tags["X-Price-Source"]
    local requestor = msg.Tags["X-Requestor"]

    print("  Token: " .. tostring(tokenTicker))
    print("  Source: " .. tostring(priceSource))
    print("  Requestor: " .. tostring(requestor))

    -- Check if we have response data
    if not msg.Data or msg.Data == "" then
        print("❌ No data received in token price response")
        return
    end

    -- Try to parse the JSON response
    local success, parsedData = pcall(json.decode, msg.Data)
    if not success then
        print("❌ Failed to parse token price response JSON")
        print("  Error: " .. tostring(parsedData))
        return
    end

    print("✅ Successfully parsed token price response")
    print("  Response structure: " .. json.encode(parsedData))

    -- The relay response might be nested in a 'data' field
    local actualData = parsedData
    if parsedData.data then
        print("  Found nested 'data' field, using that")
        actualData = parsedData.data
    end

    -- Process based on price source
    if priceSource == "coingecko" then
        processCoingeckoPriceResponse(tokenTicker, actualData, requestor)
    elseif priceSource == "GUSCustom" then
        processGUSCustomPriceResponse(tokenTicker, actualData, requestor)
    else
        print("⚠️ Unknown price source: " .. tostring(priceSource))
    end
end

-- Process coingecko price responses
function processCoingeckoPriceResponse(tokenTicker, parsedData, requestor)
    print("📊 Processing coingecko price data for " .. tokenTicker)
    print("  Parsed data keys: " .. json.encode(parsedData))

    -- Check if we have price data
    if not parsedData.prices or #parsedData.prices == 0 then
        print("❌ No price data found in coingecko response")
        print("  Available keys: " .. json.encode(parsedData))
        if parsedData.prices then
            print("  Prices array length: " .. #parsedData.prices)
        end
        return
    end

    -- Get the most recent price (last entry in the array)
    local latestPriceData = parsedData.prices[#parsedData.prices]
    local timestamp = latestPriceData[1] -- Unix timestamp in milliseconds
    local price = latestPriceData[2]     -- Price in USD

    print("  Latest Price: $" .. string.format("%.6f", price))
    print("  Timestamp: " .. timestamp)

    -- Store the token price
    if not TokenPrices then TokenPrices = {} end
    if not TokenPrices[tokenTicker] then TokenPrices[tokenTicker] = {} end

    TokenPrices[tokenTicker] = {
        price = price,
        timestamp = timestamp,
        source = "coingecko",
        lastUpdated = os.time()
    }

    print("💾 Token price cached for " .. tokenTicker)

    -- Send response back to requestor if not a cron job
    if requestor and requestor ~= "crontroller" then
        ao.send({
            Target = requestor,
            Action = "token-price-updated",
            Token = tokenTicker,
            Price = price,
            Timestamp = timestamp,
            Source = "coingecko",
            Status = "success"
        })
        print("📤 Price update sent to requestor: " .. requestor)
    elseif requestor == "crontroller" then
        print("🕐 Cron job: Token price cache updated silently")
    end

    -- Also store market cap and volume if available
    if parsedData.market_caps and #parsedData.market_caps > 0 then
        local latestMarketCap = parsedData.market_caps[#parsedData.market_caps]
        TokenPrices[tokenTicker].marketCap = latestMarketCap[2]
        print("  Market Cap: $" .. string.format("%.2f", latestMarketCap[2]))
    end

    if parsedData.total_volumes and #parsedData.total_volumes > 0 then
        local latestVolume = parsedData.total_volumes[#parsedData.total_volumes]
        TokenPrices[tokenTicker].volume = latestVolume[2]
        print("  Volume: $" .. string.format("%.2f", latestVolume[2]))
    end
end

-- Process GUSCustom price responses
function processGUSCustomPriceResponse(tokenTicker, parsedData, requestor)
    print("🥧 Processing GUSCustom price data for " .. tokenTicker)

    -- Check if we have the required fields
    if not parsedData.estimatedOutput or not parsedData.denomination then
        print("❌ Missing required fields in GUSCustom response")
        print("  estimatedOutput: " .. tostring(parsedData.estimatedOutput))
        print("  denomination: " .. tostring(parsedData.denomination))
        return
    end

    -- Extract price data
    local estimatedOutput = parsedData.estimatedOutput
    local denomination = parsedData.denomination
    local timestamp = parsedData.timestamp or os.time()

    -- Debug: Print all available fields to understand the data structure
    print("🔍 GUSCustom response fields:")
    for key, value in pairs(parsedData) do
        print("  " .. key .. ": " .. tostring(value))
    end

    -- Calculate actual USD price from wUSDC output
    -- wUSDC has 6 decimals, so 1000000 = $1.00
    -- estimatedOutput represents how many wUSDC tokens we get for 1 full token
    local wusdcDecimals = 6
    local actualUsdPrice = estimatedOutput / (10 ^ wusdcDecimals)

    -- Check if there's a wusdcOutput field that might be different
    if parsedData.wusdcOutput and parsedData.wusdcOutput ~= estimatedOutput then
        print("⚠️ Warning: wusdcOutput (" ..
            parsedData.wusdcOutput .. ") differs from estimatedOutput (" .. estimatedOutput .. ")")
        local wusdcPrice = parsedData.wusdcOutput / (10 ^ wusdcDecimals)
        print("  wusdcOutput calculated price: $" .. string.format("%.12f", wusdcPrice))
    end

    print("  Estimated Output (wUSDC): " .. estimatedOutput)
    print("  wUSDC Decimals: " .. wusdcDecimals)
    print("  Calculated USD Price: $" .. string.format("%.12f", actualUsdPrice))
    print("  Denomination: " .. denomination)
    print("  Timestamp: " .. timestamp)

    -- Store the token price
    if not TokenPrices then TokenPrices = {} end
    if not TokenPrices[tokenTicker] then TokenPrices[tokenTicker] = {} end

    TokenPrices[tokenTicker] = {
        price = actualUsdPrice,
        timestamp = timestamp,
        source = "GUSCustom",
        lastUpdated = os.time(),
        denomination = denomination,
        estimatedOutput = estimatedOutput,
        wusdcOutput = estimatedOutput
    }

    -- Add quote information if available
    if parsedData.quote then
        TokenPrices[tokenTicker].quote = {
            totalRoutesFound = parsedData.quote.totalRoutesFound,
            validRoutesWithEstimates = parsedData.quote.validRoutesWithEstimates,
            executionTime = parsedData.quote.executionTime,
            bestRoute = {
                dex = parsedData.quote.bestRoute and parsedData.quote.bestRoute.dex,
                hops = parsedData.quote.bestRoute and parsedData.quote.bestRoute.hops,
                estimatedOutput = parsedData.quote.bestRoute and parsedData.quote.bestRoute.estimatedOutput,
                estimatedFee = parsedData.quote.bestRoute and parsedData.quote.bestRoute.estimatedFee
            }
        }
        print("  Quote data cached with " .. parsedData.quote.totalRoutesFound .. " routes found")
    end

    print("💾 Token price cached for " .. tokenTicker)

    -- Send response back to requestor if not a cron job
    if requestor and requestor ~= "crontroller" then
        ao.send({
            Target = requestor,
            Action = "token-price-updated",
            Token = tokenTicker,
            Price = actualUsdPrice,
            Timestamp = timestamp,
            Source = "GUSCustom",
            Status = "success"
        })
        print("📤 Price update sent to requestor: " .. requestor)
    elseif requestor == "crontroller" then
        print("🕐 Cron job: Token price cache updated silently")
    end
end

function isTokenInfoResponse(msg)
    if not msg.Action and msg.Tags.Logo and msg.Tags.Denomination then
        print("Token Info Response Received.")
        return true
    end
    if msg.Action and msg.Action == "Info-Notice" then
        print("Token Info Notice Received.")
        return true
    end
    return false
end

Handlers.add(
    "Add-Token-To-Portfolio",
    Handlers.utils.hasMatchingTag("Action", "Add-Token-To-Portfolio"),
    function(msg)
        if not isAuthorized(msg) then
            print("❌ Error: Unauthorized access attempt")
            return
        end

        -- Check for TokenId in tags (case-insensitive)
        local tokenId = msg.Tags["TokenId"] or msg.Tags["Tokenid"] or msg.Tags["tokenid"]
        if not tokenId then
            print("❌ Error: No TokenId provided in tags")
            print("Available tags:")
            for tagName, tagValue in pairs(msg.Tags) do
                print("  " .. tagName .. " = " .. tostring(tagValue))
            end
            return
        end

        print("📝 Adding token to portfolio: " .. tokenId)

        -- Initialize portfolio entry if it doesn't exist
        if not TokenPortfolio[tokenId] then
            TokenPortfolio[tokenId] = {
                ["Price-Source"] = "GUSCustom",
                ["Price-URL"] = "https://GusHasTheBestPrices.com/api/v69/price/${tokenId}"
            }
        end

        -- Request token info
        ao.send({
            Target = tokenId,
            Action = "Info"
        })

        print("📤 Info request sent to token: " .. tokenId)
    end
)

Handlers.add("Info-Handler", isTokenInfoResponse, function(msg)
    print("Info-Handler received for " .. msg.From)

    -- Check if we have a portfolio entry for this token
    if not TokenPortfolio[msg.From] then
        print("❌ Error: No TokenPortfolio entry found for " .. msg.From)
        print("Creating default portfolio entry...")
        TokenPortfolio[msg.From] = {
            ["Price-Source"] = "GUSCustom",
            ["Price-URL"] = "https://GusHasTheBestPrices.com/api/v69/price/${tokenId}"
        }
    end

    -- Extract token info from tags
    local logo = msg.Tags.Logo
    local denomination = msg.Tags.Denomination
    local ticker = msg.Tags.Ticker or msg.Tags["Price-Ticker"]

    print("  Logo: " .. tostring(logo))
    print("  Denomination: " .. tostring(denomination))
    print("  Ticker: " .. tostring(ticker))

    -- Create or update token entry
    local tokenName = ticker or msg.From
    if not Tokens[tokenName] then
        Tokens[tokenName] = {}
    end

    Tokens[tokenName] = {
        Logo = logo,
        Denomination = denomination,
        ["Price-Ticker"] = ticker,
        TokenId = msg.From,
        ["Price-Source"] = TokenPortfolio[msg.From]["Price-Source"],
        ["Price-URL"] = TokenPortfolio[msg.From]["Price-URL"]
    }

    -- Update portfolio entry with token info
    TokenPortfolio[msg.From] = Tokens[tokenName]

    print("✅ Token info stored for " .. tokenName)

    -- Request balance
    ao.send({
        Target = msg.From,
        Action = "Balance",
        Recipient = Owner
    })

    print("📤 Balance request sent to token: " .. msg.From)
end)

function isTokenBalanceResponse(msg)
    if not msg.Action and msg.Tags.Balance then
        print("Token Balance Response Received.")
        return true
    end
    if msg.Action and msg.Action == "Balance-Notice" then
        print("Token Balance Notice Received.")
        return true
    end
    return false
end

Handlers.add(
    "Balance-Handler",
    isTokenBalanceResponse,
    function(msg)
        print("Balance-Handler received for " .. msg.From)

        -- Check if we have data
        if not msg.Data or msg.Data == "" then
            print("❌ Error: No balance data received")
            return
        end

        -- Parse balance
        local balance = tonumber(msg.Data)
        if not balance then
            print("❌ Error: Invalid balance data: " .. tostring(msg.Data))
            return
        end

        -- Store balance
        if not TokenBalances[msg.From] then
            TokenBalances[msg.From] = 0
        end
        TokenBalances[msg.From] = balance

        print("✅ Balance updated for " .. msg.From .. ": " .. balance)

        -- Also update the token entry with balance if it exists
        for tokenName, tokenData in pairs(Tokens) do
            if tokenData.TokenId == msg.From then
                tokenData.Balance = balance
                print("  Updated " .. tokenName .. " balance: " .. balance)
                break
            end
        end
    end
)

function getTokenBalances()
    local parsedBalances = {}

    print("💰 Getting parsed token balances...")

    -- Iterate through each token balance
    for tokenId, rawBalance in pairs(TokenBalances) do
        print("  Processing token: " .. tokenId .. " with raw balance: " .. rawBalance)

        -- Find this token in TokenPortfolio to get denomination
        local portfolioEntry = TokenPortfolio[tokenId]
        if portfolioEntry and portfolioEntry.Denomination then
            local denomination = tonumber(portfolioEntry.Denomination)
            local ticker = portfolioEntry["Price-Ticker"] or tokenId

            print("    Found in portfolio - Denomination: " .. denomination .. ", Ticker: " .. ticker)

            -- Convert raw balance to full tokens
            -- rawBalance / (10 ^ denomination) = full tokens
            local fullTokens = rawBalance / (10 ^ denomination)

            print("    Converted: " .. rawBalance .. " / (10^" .. denomination .. ") = " .. fullTokens .. " full tokens")

            -- Store the parsed balance
            parsedBalances[ticker] = {
                raw = rawBalance,
                parsed = fullTokens,
                denomination = denomination,
                tokenId = tokenId
            }
        else
            print("    ⚠️ No portfolio entry found for " .. tokenId .. ", skipping")
        end
    end

    print("✅ Parsed balances complete. Found " .. #parsedBalances .. " tokens")
    return parsedBalances
end

Handlers.add(
    "cron-request-token-balances",
    Handlers.utils.hasMatchingTag("Action", "cron-request-token-balances"),
    function(msg)
        print("🔄 cron-request-token-balances: Starting token balance requests...")

        if not TokenPortfolio or not next(TokenPortfolio) then
            print("⚠️ No tokens in portfolio to request balances for")
            return
        end

        local requestCount = 0
        for tokenId, tokenData in pairs(TokenPortfolio) do
            print("📊 Requesting balance for token: " .. tokenId)
            ao.send({
                Target = tokenId,
                Action = "Balance",
                Recipient = Owner
            })
            requestCount = requestCount + 1
        end

        print("✅ Sent " .. requestCount .. " balance requests")
    end
)

return Tokens
