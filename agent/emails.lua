-- Cron job handlers for automated tasks
-- This file contains handlers for scheduled operations like daily emails, cache updates, etc.

local json = require("json")

-- Authorization function
local function isAuthorized(msg)
    return msg.From == Owner or msg.From == CrontrollerProcessId
end

-- Handler for daily email summary (cron job)
-- This handler queries the actual calendar and weather data directly from their modules
-- It does NOT use sample data - it reads from the real calendar events and weather cache
Handlers.add("cron-daily-email",
    Handlers.utils.hasMatchingTag("Action", "cron-daily-email"),
    function(msg)
        if not isAuthorized(msg) then
            print("❌ Error: Unauthorized daily email attempt")
            return
        end

        print("📧 Starting daily email summary generation...")

        -- Debug: Check global table access
        print("🔍 Debug: Checking global table access...")
        print("  Global calendar table: " .. tostring(calendar))
        print("  Global weather table: " .. tostring(weather))
        print("  Global weatherCache table: " .. tostring(weatherCache))

        -- Get current date for context using timezone-aware functions
        local currentTime = os.time()        -- This returns milliseconds since epoch
        local currentTimestamp = currentTime -- Current time in milliseconds

        -- Use timezone-aware functions from calendar.lua
        local currentLocalTime = getCurrentLocalTimestamp and getCurrentLocalTimestamp(msg) or currentTimestamp
        local currentDate = timestampToDate and timestampToDate(currentLocalTime) or nil
        local dayStartMs, dayEndMs, today

        if not currentDate then
            -- Fallback: use simple day boundary calculation
            dayStartMs = currentTimestamp - (currentTimestamp % 86400000) -- Start of current day in milliseconds
            dayEndMs = dayStartMs + 86400000                              -- End of current day in milliseconds
            today = "today"

            print("📅 Current timestamp: " .. currentTimestamp)
            print("📅 Day start (ms): " .. dayStartMs)
            print("📅 Day end (ms): " .. dayEndMs)
            print("📅 Generating summary for: " .. today)
        else
            -- Use the calendar.lua conversion functions with timezone awareness
            local dayStart = dateToTimestamp and
                dateToTimestamp(currentDate.year, currentDate.month, currentDate.day, 0, 0, 0) or nil
            local dayEnd = dayStart and (dayStart + 86400000) or nil

            if dayStart and dayEnd then
                dayStartMs = dayStart
                dayEndMs = dayEnd
                today = currentDate.month .. "/" .. currentDate.day .. "/" .. currentDate.year

                print("📅 Current timestamp (UTC): " .. currentTimestamp)
                print("📅 Current local timestamp: " .. currentLocalTime)
                print("📅 Timezone: " .. (calendar and calendar.timezone or "Unknown"))
                print("📅 Day start (ms): " .. dayStartMs)
                print("📅 Day end (ms): " .. dayEndMs)
                print("📅 Generating summary for: " .. today)
                print("📅 Day start (readable): " ..
                    currentDate.year ..
                    "-" ..
                    string.format("%02d", currentDate.month) ..
                    "-" .. string.format("%02d", currentDate.day) .. " 00:00:00")
                print("📅 Day end (readable): " ..
                    currentDate.year ..
                    "-" ..
                    string.format("%02d", currentDate.month) ..
                    "-" .. string.format("%02d", currentDate.day) .. " 23:59:59")
            else
                -- Fallback if calendar functions fail
                dayStartMs = currentTimestamp - (currentTimestamp % 86400000)
                dayEndMs = dayStartMs + 86400000
                today = "today"

                print("📅 Current timestamp: " .. currentTimestamp)
                print("📅 Day start (ms): " .. dayStartMs)
                print("📅 Day end (ms): " .. dayEndMs)
                print("📅 Generating summary for: " .. today)
            end
        end

        -- Gather calendar events for today
        local calendarEvents = {}



        -- Use the global calendar table directly (not module exports)
        if calendar and calendar.events then
            local allEvents = calendar.events
            local totalEvents = 0
            local todayEvents = {}

            -- Count total events and find today's events using timezone-aware functions
            for id, event in pairs(allEvents) do
                totalEvents = totalEvents + 1

                -- Use the timezone-aware isToday function instead of manual timestamp comparison
                if isToday and isToday(event.startTime, currentLocalTime) then
                    table.insert(todayEvents, event)
                    print("📅 Found today's event: " ..
                        event.eventName .. " at " .. event.startTime .. " (using timezone-aware logic)")
                else
                    -- Fallback: manual timestamp comparison if isToday function not available
                    local eventStartMs = event.startTime
                    if eventStartMs >= dayStartMs and eventStartMs < dayEndMs then
                        table.insert(todayEvents, event)
                        print("📅 Found today's event: " ..
                            event.eventName .. " at " .. eventStartMs .. " (using fallback logic)")
                    end
                end
            end

            print("📅 Total events in calendar: " .. totalEvents)
            print("📅 Events for today: " .. #todayEvents)

            calendarEvents = todayEvents
        else
        end

        -- Gather weather information for default location
        local weatherInfo = {}
        local defaultLocation = "Little France, NY" -- Default fallback

        -- Use the global weather table directly (not module exports)
        if weather then
            defaultLocation = weather.defaultLocation or "Little France, NY"

            -- Access the actual weather cache directly
            if weatherCache then
                -- Check for current weather cache
                local currentCacheKey = defaultLocation .. "_current"
                if weatherCache.current and weatherCache.current[currentCacheKey] then
                    local currentWeather = weatherCache.current[currentCacheKey]
                    weatherInfo.current = currentWeather
                else
                    weatherInfo.current = { error = "Weather data not available" }
                end

                -- Check for daily forecast cache
                local dailyCacheKey = defaultLocation .. "_daily"
                if weatherCache.daily and weatherCache.daily[dailyCacheKey] then
                    local dailyForecast = weatherCache.daily[dailyCacheKey]
                    weatherInfo.daily = dailyForecast
                else
                    weatherInfo.daily = { error = "Forecast data not available" }
                end
            else
                print("❌ Failed to access global weather cache table")
                weatherInfo.current = { error = "Weather cache not accessible" }
                weatherInfo.daily = { error = "Weather cache not accessible" }
            end
        else
            weatherInfo.current = { error = "Weather configuration not accessible" }
            weatherInfo.daily = { error = "Weather configuration not accessible" }
        end

        -- Generate email content
        local emailSubject = "🌅 GUS Daily Summary - " .. today
        local emailHtml = generateDailyEmailHtml(today, calendarEvents, weatherInfo, defaultLocation)

        -- print(msg)

        local messageToSend = {
            Target = "L7ZEASGMlsjY2AMpTwbX178slBpaHJJxznWN8oywiZY",
            Action = "Relay-Request",
            ["Request-URL"] = "https://api.brevo.com/v3/smtp/email",
            Method = "POST",
            Headers = json.encode({
                ["Content-Type"] = "application/json",
                Accept = "application/json",
                ["api-key"] = "process.env.wouldnt-you-like-to-know"
            }),
            Data = json.encode({
                sender = {
                    name = "GUS - Your Personal AO Assistant",
                    email = "signup@gigautility.com"
                },
                to = {
                    {
                        email = msg["Email-To"],
                        name = msg["Email-Name"]
                    }
                },
                subject = emailSubject,
                htmlContent = emailHtml,
                tags = { "ao-assistant", "daily-summary", "cron" },
                -- Include metadata in the data payload to reduce tag usage
                metadata = {
                    requestType = "daily-summary",
                    date = today,
                    eventsCount = #calendarEvents,
                    weatherLocation = defaultLocation,
                    requestor = "crontroller"
                }
            }),
            Timeout = "30000",
            -- Minimal tags for relay processing
            ["X-Email-Request"] = "true",
            ["X-Request-Type"] = "daily-summary"
        }
        print("Sending email to " .. msg["Email-To"])
        print(messageToSend)
        -- Send email via relay
        ao.send(messageToSend)
    end
)

-- Helper function to format weather forecast text for better readability
local function formatWeatherForecast(forecastText)
    if not forecastText then return "Forecast information available" end

    -- Replace the raw forecast text with a more structured format
    -- This will parse the GUS response and make it more readable
    local formatted = forecastText

    -- Add some basic formatting improvements
    formatted = string.gsub(formatted, "\\n", "<br>")
    -- Fix the bold formatting to capture the entire text between ** markers
    formatted = string.gsub(formatted, "\\*\\*([^*]+)\\*\\*", "<strong>%1</strong>")

    -- Special formatting for daily forecasts to make each day distinct
    if string.find(formatted, "for the next 7 days") then
        -- This is a daily forecast, let's parse it properly

        -- Add spacing after the intro
        formatted = string.gsub(formatted, "for the next 7 days:", "for the next 7 days:<br><br>")

        -- Find and format each day entry
        -- Look for patterns like "**Day 1:**", "**Day 2:**", etc.
        for dayNum = 1, 7 do
            local dayPattern = "%*%*Day " .. dayNum .. ":%*%*"
            local nextDayPattern = "%*%*Day " .. (dayNum + 1) .. ":%*%*"

            -- Find the start of this day
            local dayStart = string.find(formatted, dayPattern)
            if dayStart then
                -- Find the start of the next day (or end of text)
                local dayEnd = string.find(formatted, nextDayPattern, dayStart)
                local dayContent

                if dayEnd then
                    -- Extract content up to next day
                    dayContent = string.sub(formatted, dayStart, dayEnd - 1)
                else
                    -- Last day, extract to end
                    dayContent = string.sub(formatted, dayStart)
                end

                -- Format this day with proper spacing
                dayContent = string.gsub(dayContent, dayPattern, "<br><br><strong>Day " .. dayNum .. ":</strong>")

                -- Replace the original day content with formatted version
                if dayEnd then
                    formatted = string.sub(formatted, 1, dayStart - 1) .. dayContent .. string.sub(formatted, dayEnd)
                else
                    formatted = string.sub(formatted, 1, dayStart - 1) .. dayContent
                end
            end
        end
    end

    return formatted
end

-- Helper function to generate daily email HTML
function generateDailyEmailHtml(date, events, weather, location)
    local html = [[
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Summary - ]] .. date .. [[</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .header .date { margin-top: 10px; opacity: 0.9; font-size: 18px; }
        .header .subtitle { margin-top: 8px; opacity: 0.8; font-size: 16px; font-style: italic; }
        .section { background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #667eea; }
        .section h2 { margin-top: 0; color: #495057; font-size: 20px; }
        .event { background: white; padding: 20px; border-radius: 6px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .event h3 { margin: 0 0 10px 0; color: #495057; font-size: 18px; }
        .event .time { color: #6c757d; font-size: 14px; margin-bottom: 8px; }
        .event .location { color: #495057; font-weight: 500; }
        .weather { display: flex; align-items: flex-start; gap: 15px; }
        .weather-icon { font-size: 48px; margin-top: 5px; }
        .weather-details { flex: 1; }
        .forecast-content { line-height: 1.8; }
        .forecast-content strong { color: #495057; }
        .forecast-content br + br + strong {
            display: block;
            margin-top: 15px;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .forecast-content strong {
            color: #495057;
            font-size: 16px;
        }
        .daily-forecast-day {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 3px solid #667eea;
        }
        .footer { text-align: center; margin-top: 40px; padding: 20px; color: #6c757d; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌅 Good Morning from GUS!</h1>
        <div class="date">]] .. date .. [[</div>
        <div class="subtitle">Your Personal AO Assistant 🤖</div>
    </div>]]

    -- Add AO Distribution section if available
    if LastDist and LastDist["AO"] then
        local aoAmount = LastDist["AO"]["parsed"]
        local aoUsdValue = ""

        -- Calculate USD value if token price is available
        if TokenPrices and TokenPrices["AO"] and TokenPrices["AO"].price then
            local aoPrice = TokenPrices["AO"].price
            local usdValue = aoAmount * aoPrice
            aoUsdValue = " (≈ $" .. string.format("%.2f", usdValue) .. ")"
        end

        html = html .. [[
    <div class="section" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; border-left: 4px solid #ff6b6b;">
        <h2 style="color: white;">💰 Latest AO Distribution</h2>
        <div style="font-size: 18px; margin-bottom: 10px;">
            <strong>Amount:</strong> ]] .. aoAmount .. [[ AO]] .. aoUsdValue .. [[
        </div>]]

        -- Add price information if available
        if TokenPrices and TokenPrices["AO"] and TokenPrices["AO"].price then
            html = html .. [[
        <div style="font-size: 14px; margin-bottom: 8px; opacity: 0.9;">
            <strong>Current Price:</strong> $]] .. string.format("%.6f", TokenPrices["AO"].price) .. [[
        </div>]]
        end

        html = html .. [[
        <div style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
            <em>This is the most recent available AO distribution data for your wallet.</em>
        </div>
    </div>]]
    end

    -- Add PI Distribution section if available
    if LastDist and LastDist["PI"] then
        local piAmount = LastDist["PI"]["parsed"]
        local piUsdValue = ""

        -- Calculate USD value if token price is available
        if TokenPrices and TokenPrices["PI"] and TokenPrices["PI"].price then
            local piPrice = TokenPrices["PI"].price
            local usdValue = piAmount * piPrice
            piUsdValue = " (≈ $" .. string.format("%.2f", usdValue) .. ")"
        end

        html = html .. [[
    <div class="section" style="background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%); color: white; border-left: 4px solid #4ecdc4;">
        <h2 style="color: white;">🥧 Latest PI Distribution</h2>
        <div style="font-size: 18px; margin-bottom: 10px;">
            <strong>Amount:</strong> ]] .. piAmount .. [[ PI]] .. piUsdValue .. [[
        </div>]]

        -- Add price information if available
        if TokenPrices and TokenPrices["PI"] and TokenPrices["PI"].price then
            html = html .. [[
        <div style="font-size: 14px; margin-bottom: 8px; opacity: 0.9;">
            <strong>Current Price:</strong> $]] .. string.format("%.6f", TokenPrices["PI"].price) .. [[
        </div>]]
        end

        html = html .. [[
        <div style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
            <em>This is the most recent available PI distribution data for your wallet.</em>
        </div>
    </div>]]
    end

    -- Add Token Portfolio section if available
    if TokenPortfolio and next(TokenPortfolio) then
        html = html .. [[
    <div class="section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-left: 4px solid #667eea;">
        <h2 style="color: white;">💼 Your Token Portfolio</h2>]]

        -- Get parsed token balances
        local tokenBalances = getTokenBalances()
        local totalPortfolioValue = 0
        local portfolioItems = 0

        for ticker, balanceData in pairs(tokenBalances) do
            if balanceData.parsed > 0 then
                portfolioItems = portfolioItems + 1
                local tokenPrice = TokenPrices and TokenPrices[ticker] and TokenPrices[ticker].price
                local usdValue = ""
                local priceInfo = ""

                -- Calculate USD value if price is available
                if tokenPrice then
                    local usdValueAmount = balanceData.parsed * tokenPrice
                    totalPortfolioValue = totalPortfolioValue + usdValueAmount
                    usdValue = " (≈ $" .. string.format("%.2f", usdValueAmount) .. ")"

                    priceInfo = [[
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
                <strong>Price:</strong> $]] .. string.format("%.6f", tokenPrice) .. [[
            </div>]]
                end

                html = html .. [[
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <div style="font-size: 16px; margin-bottom: 8px;">
                <strong>]] .. ticker .. [[</strong>]] .. usdValue .. [[
            </div>
            <div style="font-size: 14px; margin-bottom: 4px;">
                <strong>Balance:</strong> ]] .. string.format("%.6f", balanceData.parsed) .. [[ tokens
            </div>]] .. priceInfo .. [[
        </div>]]
            end
        end

        -- Add portfolio summary
        if totalPortfolioValue > 0 then
            html = html .. [[
        <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin-top: 15px; text-align: center;">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
                Total Portfolio Value: $]] .. string.format("%.2f", totalPortfolioValue) .. [[
            </div>
            <div style="font-size: 14px; opacity: 0.9;">
                ]] .. portfolioItems .. [[ token]] .. (portfolioItems == 1 and "" or "s") .. [[ with balances
            </div>
        </div>]]
        end

        html = html .. [[
        <div style="font-size: 12px; opacity: 0.8; margin-top: 15px;">
            <em>Your current token holdings and their estimated USD values.</em>
        </div>
    </div>]]
    end

    -- Add Notes section if available
    local currentNote = getNote()
    if currentNote and currentNote ~= "" then
        html = html .. [[
    <div class="section" style="background: linear-gradient(135deg, #ffd93d 0%, #ff6b6b 100%); color: white; border-left: 4px solid #ffd93d;">
        <h2 style="color: white;">📝 Today's Note</h2>
        <div style="font-size: 16px; line-height: 1.6; margin-bottom: 10px;">
            ]] .. currentNote .. [[
        </div>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
            <em>Your personal note for today.</em>
        </div>
    </div>]]
    end

    html = html .. [[
    <div class="section">
        <h2>📅 Today's Schedule</h2>]]

    if #events > 0 then
        for i, event in ipairs(events) do
            -- Just display the raw Unix timestamps
            local startTimeStr = "Start: " .. event.startTime
            local endTimeStr = "End: " .. event.endTime

            html = html .. [[
        <div class="event">
            <h3>]] .. event.eventName .. [[</h3>
            <div class="time">🕐 ]] .. startTimeStr .. [[ - ]] .. endTimeStr .. [[</div>
            <div class="location">📍 ]] .. (event.location or "No location specified") .. [[</div>
            <div class="description">]] .. (event.description or "No description") .. [[</div>
        </div>]]
        end
    else
        html = html .. [[
        <p>No events scheduled for today. Enjoy your free time! 🎉</p>]]
    end

    html = html .. [[
    </div>

    <div class="section">
        <h2>🌤️ Weather for ]] .. location .. [[</h2>]]

    if weather.current and not weather.current.error then
        html = html .. [[
        <div class="weather">
            <div class="weather-icon">🌤️</div>
            <div class="weather-details">
                <h3>🌡️ GUS's Current Weather Report</h3>
                <div class="forecast-content">]] .. formatWeatherForecast(weather.current.description) .. [[</div>
            </div>
        </div>]]
    else
        html = html .. [[
        <p>🌤️ GUS is checking the weather for you... Please check back later!</p>]]
    end

    if weather.daily and not weather.daily.error then
        html = html .. [[
        <div class="weather">
            <div class="weather-icon">🌤️</div>
            <div class="weather-details">
                <h3>🌤️ GUS's Daily Forecast</h3>
                <div class="forecast-content">]] .. formatWeatherForecast(weather.daily.description) .. [[</div>
            </div>
        </div>]]
    end

    html = html .. [[
    </div>

    <div class="footer">
        <p>Generated by <strong>GUS</strong> - Your Personal AO Assistant 🤖</p>
        <p>Brought to you by Giga Utility Services</p>
        <p>Have a wonderful day! 🌟</p>
    </div>
</body>
</html>]]

    return html
end

-- Future cron handlers can be added here:
-- - cron-hourly-weather-update
-- - cron-daily-weather-update
-- - cron-weekly-summary
-- - cron-monthly-report
-- - cron-cache-cleanup

-- Export the emails module
return {
    -- Export any functions that other modules might need
    -- For now, just export the module name for identification
    moduleName = "emails"
}
