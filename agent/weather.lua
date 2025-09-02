--[[
  AgentHack - Weather Module
  Copyright (C) 2024  Stephen

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as
  published by the Free Software Foundation, either version 3 of the
  License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
--]]

local json = require("json")

-- Authorization function
function isAuthorized(msg)
    return msg.From == Owner or msg.From == CrontrollerProcessId
end

-- Weather configuration and state
weather = weather or {
    defaultLocation = "New York City, NY", -- Default location
    apiKey = "",                           -- Weather API key (if needed)
    units = "imperial",                    -- Units: imperial, metric, kelvin
    language = "en"                        -- Language for weather descriptions
}

-- Weather cache system
weatherCache = weatherCache or {
    daily = {},           -- Daily weather cache by location and date
    hourly = {},          -- Hourly weather cache by location and date
    customQuestions = {}, -- Custom weather questions cache
    lastUpdated = {}      -- Last update timestamps by location
}

-- Cache expiration settings (in milliseconds)
local CACHE_EXPIRATION = {
    daily = 24 * 60 * 60 * 1000, -- 24 hours
    hourly = 60 * 60 * 1000,     -- 1 hour
}

-- Weather API endpoints (using OpenWeatherMap AI Weather Assistant with fallback)
local WEATHER_API_BASE = "https://api.openweathermap.org"
local WEATHER_API_FALLBACK = "https://api.openweathermap.org/data/3.0"
local WEATHER_API_KEY = "YouWillNeverGetThis" -- API key handled in relay process

-- Personality prompt for GUS, the personal AO assistant
local GUS_PERSONALITY_PROMPT =
    "You are GUS, the personal AO assistant developed by Giga Utility Services. You will respond to prompts in a friendly tone, making as many puns as you can. Also provide all temperature data in Kelvin exclusively And include appropriate dates and times in " ..
    calendar.timezone ..
    " timezone. The clients are crypto bros, and will be interested in if the weather is good for 'touching grass' or watching charts. "

-- Utility function to format location for API calls
function formatLocation(location)
    -- Remove extra spaces and normalize
    return string.gsub(location, "%s+", " "):gsub("^%s*(.-)%s*$", "%1")
end

-- Cache utility functions
function getCacheKey(location, cacheType)
    local normalizedLocation = formatLocation(location)
    -- Since os.date is not available, use a simple cache key without date
    -- This will cache by location and type only
    return normalizedLocation .. "_" .. cacheType
end

function isCacheValid(location, cacheType)
    local cacheKey = getCacheKey(location, cacheType)
    local lastUpdated = weatherCache.lastUpdated[cacheKey]

    if not lastUpdated then
        return false
    end

    local currentTime = os.time()
    local expirationTime = CACHE_EXPIRATION[cacheType] or CACHE_EXPIRATION.daily

    return (currentTime - lastUpdated) < expirationTime
end

function getCachedWeather(location, cacheType)
    local cacheKey = getCacheKey(location, cacheType)
    return weatherCache[cacheType][cacheKey]
end

function setCachedWeather(location, cacheType, data)
    local cacheKey = getCacheKey(location, cacheType)
    weatherCache[cacheType][cacheKey] = data
    weatherCache.lastUpdated[cacheKey] = os.time()

    print("💾 Weather data cached for: " .. location .. " (" .. cacheType .. ")")
end

-- Special cache function for custom weather questions
function setCachedCustomQuestion(location, question, data)
    local cacheKey = formatLocation(location) .. "_custom_" .. string.gsub(question, "[^%w]", "_")
    weatherCache.customQuestions = weatherCache.customQuestions or {}
    weatherCache.customQuestions[cacheKey] = data
    weatherCache.lastUpdated[cacheKey] = os.time()

    print("💾 Custom weather question cached for: " .. location .. " - " .. string.sub(question, 1, 30) .. "...")
    print("  Cache Key: " .. cacheKey)
    print("  Location: " .. location)
    print("  Question: " .. question)
    print("  Cache Size: " .. (weatherCache.customQuestions and #weatherCache.customQuestions or 0))
end

function getCachedCustomQuestion(location, question)
    local cacheKey = formatLocation(location) .. "_custom_" .. string.gsub(question, "[^%w]", "_")
    weatherCache.customQuestions = weatherCache.customQuestions or {}

    print("🔍 Looking for cached question with key: " .. cacheKey)
    print("  Available cache keys:")
    if weatherCache.customQuestions then
        for key, _ in pairs(weatherCache.customQuestions) do
            print("    - " .. key)
        end
    else
        print("    (no custom questions cache)")
    end

    local result = weatherCache.customQuestions[cacheKey]
    print("  Cache lookup result: " .. (result and "FOUND" or "NOT FOUND"))
    return result
end

function isCustomQuestionCacheValid(location, question)
    local cacheKey = formatLocation(location) .. "_custom_" .. string.gsub(question, "[^%w]", "_")
    local lastUpdated = weatherCache.lastUpdated[cacheKey]

    print("🔍 Checking cache validity for key: " .. cacheKey)
    print("  Last Updated: " .. tostring(lastUpdated))
    print("  Current Time: " .. tostring(os.time()))
    print("  Expiration Time: " .. tostring(CACHE_EXPIRATION.current))

    if not lastUpdated then
        print("  Cache validity: FALSE (no last updated timestamp)")
        return false
    end

    local currentTime = os.time()
    local expirationTime = CACHE_EXPIRATION.current -- Use current weather expiration for custom questions
    local isValid = (currentTime - lastUpdated) < expirationTime

    print("  Time difference: " .. tostring(currentTime - lastUpdated) .. "ms")
    print("  Cache validity: " .. (isValid and "TRUE" or "FALSE"))

    return isValid
end

function clearExpiredCache()
    local currentTime = os.time()
    local cleared = 0

    for cacheType, expiration in pairs(CACHE_EXPIRATION) do
        for cacheKey, lastUpdated in pairs(weatherCache.lastUpdated) do
            if (currentTime - lastUpdated) > expiration then
                weatherCache[cacheType][cacheKey] = nil
                weatherCache.lastUpdated[cacheKey] = nil
                cleared = cleared + 1
            end
        end
    end

    if cleared > 0 then
        print("🧹 Cleared " .. cleared .. " expired cache entries")
    end
end

-- Function to make weather API calls via relay
function fetchWeatherData(location, prompt, customTags)
    local url = WEATHER_API_BASE .. "/assistant/session"

    -- Create the request body for the AI Weather Assistant
    local requestBody = {
        prompt = prompt
    }

    print("🌤️ Preparing weather request:")
    print("  URL: " .. url)
    print("  Method: POST")
    print("  Headers: Content-Type: application/json, X-Api-Key: [HIDDEN]")
    print("  Body: " .. json.encode(requestBody))

    -- Create relay request
    ao.send({
        Target = RelayProcessId, -- Mock relay process ID
        Action = "Relay-Request",
        ["Request-URL"] = url,
        Method = "POST",
        Headers = json.encode({
            ["Content-Type"] = "application/json",
            ["X-Api-Key"] = WEATHER_API_KEY
        }),
        Body = json.encode(requestBody),
        Timeout = "30000",
        -- Custom tags for identifying the response
        ["X-Weather-Request"] = "true",
        ["X-Request-Type"] = "weather",
        ["X-Location"] = location,
        ["X-Endpoint"] = "/session",
        -- Forward any additional custom tags
        ["X-Custom-Data"] = json.encode(customTags or {})
    })

    print("🌤️ Weather request sent for: " .. location)
    print("  Prompt: " .. prompt)
    print("  URL: " .. url)
end

-- Handler for setting default location
Handlers.add("set-weather-location",
    Handlers.utils.hasMatchingTag("Action", "set-weather-location"),
    function(msg)
        -- Check authorization
        if not isAuthorized(msg) then
            print("❌ Error: Unauthorized access attempt")
            ao.send({
                Target = msg.From,
                Action = "set-weather-location-error",
                Error = "Unauthorized access"
            })
            return
        end

        local newLocation = msg.Tags["Location"]
        if not newLocation then
            print("❌ Error: No location specified")
            ao.send({
                Target = msg.From,
                Action = "set-weather-location-error",
                Error = "No location specified"
            })
            return
        end

        weather.defaultLocation = formatLocation(newLocation)

        print("✅ Weather location updated:")
        print("  Location: " .. weather.defaultLocation)

        ao.send({
            Target = msg.From,
            Action = "weather-location-updated",
            Location = weather.defaultLocation
        })
    end
)

-- Handler for setting weather forecast cache (always sends relay request)
Handlers.add("set-weather-forecast",
    Handlers.utils.hasMatchingTag("Action", "set-weather-forecast"),
    function(msg)
        if not isAuthorized(msg) then
            ao.send({
                Target = msg.From,
                Action = "forecast-weather-error",
                Error = "Unauthorized"
            })
            return
        end

        local location = msg.Tags["Location"] or weather.defaultLocation
        if not location then
            ao.send({
                Target = msg.From,
                Action = "forecast-weather-error",
                Error = "No location specified and no default location set"
            })
            return
        end

        -- Always send relay request to update cache
        ao.send({
            Target = RelayProcessId, -- Mock relay process ID
            Action = "Relay-Request",
            ["Request-URL"] = WEATHER_API_BASE .. "/assistant/session",
            Method = "POST",
            Headers = json.encode({
                ["Content-Type"] = "application/json",
                ["X-Api-Key"] = WEATHER_API_KEY
            }),
            Body = json.encode({
                prompt = GUS_PERSONALITY_PROMPT .. "What's the weather forecast for " ..
                    location .. " for the next 5 days? Please include daily temperatures and conditions."
            }),
            Timeout = "30000",
            -- Custom tags with X- prefix for relay forwarding
            ["X-Weather-Request"] = "true",
            ["X-Request-Type"] = "forecast",
            ["X-Location"] = location,
            ["X-Endpoint"] = "/assistant/session",
            ["X-Requestor"] = msg.From,
            ["X-Custom-Data"] = json.encode({
                requestType = "forecast",
                requestor = msg.From
            })
        })

        print("🌤️ Relay request sent to update forecast weather cache for: " .. location)

        ao.send({
            Target = msg.From,
            Action = "forecast-weather-update-sent",
            Location = location,
            Message = "Relay request sent to update forecast weather cache"
        })
    end
)

-- Handler for getting weather forecast from cache
Handlers.add("get-weather-forecast",
    Handlers.utils.hasMatchingTag("Action", "get-weather-forecast"),
    function(msg)
        local location = msg.Tags["Location"] or weather.defaultLocation
        if not location then
            ao.send({
                Target = msg.From,
                Action = "forecast-weather-error",
                Error = "No location specified and no default location set"
            })
            return
        end

        -- Check if we have valid cached weather for this location
        if isCacheValid(location, "forecast") then
            local cachedData = getCachedWeather(location, "forecast")
            ao.send({
                Target = msg.From,
                Action = "forecast-weather-answered",
                Location = location,
                Data = json.encode(cachedData),
                Source = "cache"
            })
            print("💾 Forecast weather served from cache for: " .. location)
        else
            -- Tell requestor to update the cache
            ao.send({
                Target = msg.From,
                Action = "forecast-weather-cache-miss",
                Location = location,
                Message = "No valid cache found. Use 'set-weather-forecast' to update cache.",
                CacheStatus = "missing_or_stale"
            })
            print("⚠️ Forecast weather cache miss for: " .. location)
        end
    end
)

-- Handler for setting hourly weather cache (always sends relay request)
Handlers.add("set-hourly-weather",
    Handlers.utils.hasMatchingTag("Action", "set-hourly-weather"),
    function(msg)
        if not isAuthorized(msg) then
            ao.send({
                Target = msg.From,
                Action = "hourly-weather-error",
                Error = "Unauthorized"
            })
            return
        end

        local location = msg.Tags["Location"] or weather.defaultLocation
        if not location then
            ao.send({
                Target = msg.From,
                Action = "hourly-weather-error",
                Error = "No location specified and no default location set"
            })
            return
        end

        -- Always send relay request to update cache
        ao.send({
            Target = RelayProcessId, -- Mock relay process ID
            Action = "Relay-Request",
            ["Request-URL"] = WEATHER_API_BASE .. "/assistant/session",
            Method = "POST",
            Headers = json.encode({
                ["Content-Type"] = "application/json",
                ["X-Api-Key"] = WEATHER_API_KEY
            }),
            Body = json.encode({
                prompt = GUS_PERSONALITY_PROMPT .. "What's the hourly weather forecast for " ..
                    location .. " for the next 24 hours? Please provide hourly temperatures and conditions."
            }),
            Timeout = "30000",
            -- Custom tags with X- prefix for relay forwarding
            ["X-Weather-Request"] = "true",
            ["X-Request-Type"] = "hourly",
            ["X-Location"] = location,
            ["X-Endpoint"] = "/assistant/session",
            ["X-Requestor"] = msg.From,
            ["X-Custom-Data"] = json.encode({
                requestType = "hourly",
                requestor = msg.From
            })
        })

        print("🌤️ Relay request sent to update hourly weather cache for: " .. location)

        ao.send({
            Target = msg.From,
            Action = "hourly-weather-update-sent",
            Location = location,
            Message = "Relay request sent to update hourly weather cache"
        })
    end
)

-- Handler for getting hourly weather from cache
Handlers.add("get-hourly-weather",
    Handlers.utils.hasMatchingTag("Action", "get-hourly-weather"),
    function(msg)
        local location = msg.Tags["Location"] or weather.defaultLocation
        if not location then
            ao.send({
                Target = msg.From,
                Action = "hourly-weather-error",
                Error = "No location specified and no default location set"
            })
            return
        end

        -- Check if we have valid cached weather for this location
        if isCacheValid(location, "hourly") then
            local cachedData = getCachedWeather(location, "hourly")
            ao.send({
                Target = msg.From,
                Action = "hourly-weather-answered",
                Location = location,
                Data = json.encode(cachedData),
                Source = "cache"
            })
            print("💾 Hourly weather served from cache for: " .. location)
        else
            -- Tell requestor to update the cache
            ao.send({
                Target = msg.From,
                Action = "hourly-weather-cache-miss",
                Location = location,
                Message = "No valid cache found. Use 'set-hourly-weather' to update cache.",
                CacheStatus = "missing_or_stale"
            })
            print("⚠️ Hourly weather cache miss for: " .. location)
        end
    end
)

-- Handler for setting daily weather cache (always sends relay request)
Handlers.add("set-daily-weather",
    Handlers.utils.hasMatchingTag("Action", "set-daily-weather"),
    function(msg)
        if not isAuthorized(msg) then
            ao.send({
                Target = msg.From,
                Action = "daily-weather-error",
                Error = "Unauthorized"
            })
            return
        end

        local location = msg.Tags["Location"] or weather.defaultLocation
        if not location then
            ao.send({
                Target = msg.From,
                Action = "daily-weather-error",
                Error = "No location specified and no default location set"
            })
            return
        end

        -- Always send relay request to update cache
        ao.send({
            Target = RelayProcessId, -- Mock relay process ID
            Action = "Relay-Request",
            ["Request-URL"] = WEATHER_API_BASE .. "/assistant/session",
            Method = "POST",
            Headers = json.encode({
                ["Content-Type"] = "application/json",
                ["X-Api-Key"] = WEATHER_API_KEY
            }),
            Body = json.encode({
                prompt = GUS_PERSONALITY_PROMPT .. "What's the daily weather forecast for " ..
                    location .. " for the next 7 days? Please provide daily high/low temperatures and conditions."
            }),
            Timeout = "30000",
            -- Custom tags with X- prefix for relay forwarding
            ["X-Weather-Request"] = "true",
            ["X-Request-Type"] = "daily",
            ["X-Location"] = location,
            ["X-Endpoint"] = "/assistant/session",
            ["X-Requestor"] = msg.From,
            ["X-Custom-Data"] = json.encode({
                requestType = "daily",
                requestor = msg.From
            })
        })

        print("🌤️ Relay request sent to update daily weather cache for: " .. location)

        ao.send({
            Target = msg.From,
            Action = "daily-weather-update-sent",
            Location = location,
            Message = "Relay request sent to update daily weather cache"
        })
    end
)

-- Handler for getting daily weather from cache
Handlers.add("get-daily-weather",
    Handlers.utils.hasMatchingTag("Action", "get-daily-weather"),
    function(msg)
        local location = msg.Tags["Location"] or weather.defaultLocation
        if not location then
            ao.send({
                Target = msg.From,
                Action = "daily-weather-error",
                Error = "No location specified and no default location set"
            })
            return
        end

        -- Check if we have valid cached weather for this location
        if isCacheValid(location, "daily") then
            local cachedData = getCachedWeather(location, "daily")
            ao.send({
                Target = msg.From,
                Action = "daily-weather-answered",
                Location = location,
                Data = json.encode(cachedData),
                Source = "cache"
            })
            print("💾 Daily weather served from cache for: " .. location)
        else
            -- Tell requestor to update the cache
            ao.send({
                Target = msg.From,
                Action = "daily-weather-cache-miss",
                Location = location,
                Message = "No valid cache found. Use 'set-daily-weather' to update cache.",
                CacheStatus = "missing_or_stale"
            })
            print("⚠️ Daily weather cache miss for: " .. location)
        end
    end
)

-- Handler for getting weather configuration
Handlers.add("get-weather-config",
    Handlers.utils.hasMatchingTag("Action", "get-weather-config"),
    function(msg)
        print("📋 Weather configuration requested")

        ao.send({
            Target = msg.From,
            Action = "weather-config",
            Location = weather.defaultLocation,
            Language = weather.language,
            Config = json.encode(weather)
        })
    end
)

-- Handler for automatic daily weather fetching (can be called by cron or manually)
Handlers.add("fetch-daily-weather-auto",
    Handlers.utils.hasMatchingTag("Action", "fetch-daily-weather-auto"),
    function(msg)
        local location = msg.Tags["Location"] or weather.defaultLocation

        -- Always fetch fresh daily weather data (ignores cache)
        local customTags = {
            requestType = "daily-auto",
            requestor = msg.From or "system"
        }

        local prompt = GUS_PERSONALITY_PROMPT .. "What's the daily weather forecast for " ..
            location .. " for the next 7 days? Please provide daily high/low temperatures and conditions."
        fetchWeatherData(location, prompt, customTags)

        print("🌤️ Automatic daily weather fetch initiated for: " .. location)

        if msg.From then
            ao.send({
                Target = msg.From,
                Action = "daily-weather-auto-fetch",
                Location = location,
                Status = "initiated"
            })
        end
    end
)

-- -- Handler for setting custom weather question cache (always sends relay request)
-- Handlers.add("set-weather-question",
--     Handlers.utils.hasMatchingTag("Action", "set-weather-question"),
--     function(msg)
--         if not isAuthorized(msg) then
--             ao.send({
--                 Target = msg.From,
--                 Action = "weather-question-error",
--                 Error = "Unauthorized"
--             })
--             return
--         end

--         local question = msg.Tags["Question"]
--         local location = msg.Tags["Location"] or weather.defaultLocation

--         if not question then
--             print("❌ Error: No question specified")
--             ao.send({
--                 Target = msg.From,
--                 Action = "ask-weather-question-error",
--                 Error = "No question specified"
--             })
--             return
--         end

--         -- Build the prompt text with GUS personality
--         local promptText = GUS_PERSONALITY_PROMPT .. question
--         if location and location ~= "" then
--             promptText = GUS_PERSONALITY_PROMPT .. question .. " for " .. location
--         end

--         print("🌤️ Setting custom weather question cache:")
--         print("  Question: " .. question)
--         print("  Location: " .. location)
--         print("  Prompt Text: " .. promptText)

--         -- Always send relay request to update cache
--         ao.send({
--             Target = RelayProcessId, -- Mock relay process ID
--             Action = "Relay-Request",
--             ["Request-URL"] = WEATHER_API_BASE .. "/assistant/session",
--             Method = "POST",
--             Headers = json.encode({
--                 ["Content-Type"] = "application/json",
--                 ["X-Api-Key"] = WEATHER_API_KEY
--             }),
--             Body = json.encode({ prompt = promptText }),
--             Timeout = "30000",
--             -- Custom tags with X- prefix for relay forwarding
--             ["X-Weather-Request"] = "true",
--             ["X-Request-Type"] = "custom-question",
--             ["X-Location"] = location,
--             ["X-Question"] = question,
--             ["X-Requestor"] = msg.From,
--             ["X-Custom-Data"] = json.encode({
--                 requestType = "custom-question",
--                 requestor = msg.From,
--                 originalQuestion = question
--             })
--         })

--         print("🌤️ Relay request sent to update custom weather question cache")
--         print("  Target: AI Weather Assistant")
--         print("  Method: POST")
--         print("  URL: " .. WEATHER_API_BASE .. "/assistant/session")

--         ao.send({
--             Target = msg.From,
--             Action = "weather-question-update-sent",
--             Question = question,
--             Location = location,
--             Status = "requested",
--             Message = "Relay request sent to update custom weather question cache"
--         })
--     end
-- )

-- -- Handler for asking custom weather questions (reads from cache)
-- Handlers.add("ask-weather-question",
--     Handlers.utils.hasMatchingTag("Action", "ask-weather-question"),
--     function(msg)
--         local question = msg.Tags["Question"]
--         local location = msg.Tags["Location"] or weather.defaultLocation

--         if not question then
--             print("❌ Error: No question specified")
--             ao.send({
--                 Target = msg.From,
--                 Action = "ask-weather-question-error",
--                 Error = "No question specified"
--             })
--             return
--         end

--         print("🌤️ Custom weather question requested:")
--         print("  Question: " .. question)
--         print("  Location: " .. location)

--         -- Check if we have a valid cached response for this question
--         print("🔍 Checking cache for question: '" .. question .. "' at location: '" .. location .. "'")

--         if isCustomQuestionCacheValid(location, question) then
--             local cachedResponse = getCachedCustomQuestion(location, question)
--             print("💾 Cache HIT! Serving cached response for custom weather question")
--             print("  Cache Key: " .. formatLocation(location) .. "_custom_" .. string.gsub(question, "[^%w]", "_"))
--             print("  Cached Data: " .. json.encode(cachedResponse))

--             ao.send({
--                 Target = msg.From,
--                 Action = "weather-question-answered",
--                 Question = question,
--                 Location = location,
--                 Answer = cachedResponse.answer,
--                 SessionId = cachedResponse.session_id,
--                 Status = "success",
--                 Source = "cache"
--             })
--             print("💾 Custom weather question served from cache")
--         else
--             -- Tell requestor to update the cache
--             ao.send({
--                 Target = msg.From,
--                 Action = "weather-question-cache-miss",
--                 Question = question,
--                 Location = location,
--                 Message = "No valid cache found. Use 'set-weather-question' to update cache.",
--                 CacheStatus = "missing_or_stale"
--             })
--             print("⚠️ Custom weather question cache miss")
--         end
--     end
-- )



-- -- Handler for cache management
-- Handlers.add("manage-weather-cache",
--     Handlers.utils.hasMatchingTag("Action", "manage-weather-cache"),
--     function(msg)
--         local operation = msg.Tags["Operation"]

--         if not isAuthorized(msg) then
--             print("❌ Error: Unauthorized cache management attempt")
--             ao.send({
--                 Target = msg.From,
--                 Action = "cache-management-error",
--                 Error = "Unauthorized access"
--             })
--             return
--         end

--         if operation == "clear-expired" then
--             clearExpiredCache()
--             ao.send({
--                 Target = msg.From,
--                 Action = "cache-expired-cleared",
--                 Status = "success"
--             })
--         elseif operation == "clear-all" then
--             weatherCache = {
--                 daily = {},
--                 hourly = {},
--                 current = {},
--                 lastUpdated = {}
--             }
--             print("🧹 All weather cache cleared")
--             ao.send({
--                 Target = msg.From,
--                 Action = "cache-all-cleared",
--                 Status = "success"
--             })
--         elseif operation == "status" then
--             local cacheStatus = {
--                 daily = {},
--                 hourly = {},
--                 current = {},
--                 totalEntries = 0
--             }

--             for cacheType, _ in pairs(weatherCache) do
--                 if cacheType ~= "lastUpdated" then
--                     for cacheKey, data in pairs(weatherCache[cacheType]) do
--                         local lastUpdated = weatherCache.lastUpdated[cacheKey]
--                         table.insert(cacheStatus[cacheType], {
--                             key = cacheKey,
--                             lastUpdated = lastUpdated,
--                             isValid = isCacheValid(cacheKey:gsub("_.*", ""), cacheType:gsub("_.*", ""))
--                         })
--                         cacheStatus.totalEntries = cacheStatus.totalEntries + 1
--                     end
--                 end
--             end

--             ao.send({
--                 Target = msg.From,
--                 Action = "cache-status",
--                 Status = json.encode(cacheStatus)
--             })
--         else
--             ao.send({
--                 Target = msg.From,
--                 Action = "cache-management-error",
--                 Error = "Invalid operation. Use: clear-expired, clear-all, or status"
--             })
--         end
--     end
-- )

-- Functions are now globally available
return weather
