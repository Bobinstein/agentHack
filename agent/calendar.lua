local json = require("json")

-- Authorization function
local function isAuthorized(msg)
    return msg.From == Owner or msg.From == CrontrollerProcessId
end

-- Timezone conversion table (offset in minutes from UTC)
local TIMEZONE_OFFSETS = {
    -- US Timezones
    ["EST"] = -300,  -- Eastern Standard Time (UTC-5)
    ["EDT"] = -240,  -- Eastern Daylight Time (UTC-4)
    ["CST"] = -360,  -- Central Standard Time (UTC-6)
    ["CDT"] = -300,  -- Central Daylight Time (UTC-5)
    ["MST"] = -420,  -- Mountain Standard Time (UTC-7)
    ["MDT"] = -360,  -- Mountain Daylight Time (UTC-6)
    ["PST"] = -480,  -- Pacific Standard Time (UTC-8)
    ["PDT"] = -420,  -- Pacific Daylight Time (UTC-7)
    ["AKST"] = -540, -- Alaska Standard Time (UTC-9)
    ["AKDT"] = -480, -- Alaska Daylight Time (UTC-8)
    ["HST"] = -600,  -- Hawaii Standard Time (UTC-10)
    ["HDT"] = -540,  -- Hawaii Daylight Time (UTC-9)

    -- European Timezones
    ["GMT"] = 0,    -- Greenwich Mean Time (UTC+0)
    ["BST"] = 60,   -- British Summer Time (UTC+1)
    ["CET"] = 60,   -- Central European Time (UTC+1)
    ["CEST"] = 120, -- Central European Summer Time (UTC+2)
    ["EET"] = 120,  -- Eastern European Time (UTC+2)
    ["EEST"] = 180, -- Eastern European Summer Time (UTC+3)

    -- Asian Timezones
    ["JST"] = 540, -- Japan Standard Time (UTC+9)
    ["KST"] = 540, -- Korea Standard Time (UTC+9)
    ["CST"] = 480, -- China Standard Time (UTC+8)
    ["IST"] = 330, -- India Standard Time (UTC+5:30)
    ["SGT"] = 480, -- Singapore Time (UTC+8)

    -- Australian Timezones
    ["AEST"] = 600, -- Australian Eastern Standard Time (UTC+10)
    ["AEDT"] = 660, -- Australian Eastern Daylight Time (UTC+11)
    ["ACST"] = 570, -- Australian Central Standard Time (UTC+9:30)
    ["ACDT"] = 630, -- Australian Central Daylight Time (UTC+10:30)
    ["AWST"] = 480, -- Australian Western Standard Time (UTC+8)

    -- Other Common Timezones
    ["UTC"] = 0,    -- Coordinated Universal Time
    ["Z"] = 0,      -- Zulu time (UTC)
    ["MSK"] = 180,  -- Moscow Time (UTC+3)
    ["SAST"] = 120, -- South Africa Standard Time (UTC+2)
    ["BRT"] = -180, -- Brazil Time (UTC-3)
    ["ART"] = -180, -- Argentina Time (UTC-3)
}

-- Calendar configuration and state
calendar = calendar or {
    events = {},           -- Table to store all calendar events
    timezone = "EST",      -- Default timezone
    timezoneOffset = -300, -- Default offset in minutes from UTC (EST)
    nextEventId = 1        -- Auto-incrementing event ID
}

-- Initialize timezone offset based on default timezone
if TIMEZONE_OFFSETS[calendar.timezone] then
    calendar.timezoneOffset = TIMEZONE_OFFSETS[calendar.timezone]
end

-- Utility functions for date/time handling
function getCurrentTimestamp(msg)
    if msg and msg.Timestamp then
        return msg.Timestamp
    else
        return os.time()
    end
end

-- Convert UTC timestamp to local timezone timestamp
function utcToLocal(utcTimestamp)
    if not utcTimestamp then return nil end
    -- Add timezone offset (convert minutes to milliseconds)
    return utcTimestamp + (calendar.timezoneOffset * 60 * 1000)
end

-- Convert local timezone timestamp to UTC
function localToUtc(localTimestamp)
    if not localTimestamp then return nil end
    -- Subtract timezone offset (convert minutes to milliseconds)
    return localTimestamp - (calendar.timezoneOffset * 60 * 1000)
end

-- Get current time in local timezone
function getCurrentLocalTimestamp(msg)
    local utcTime = getCurrentTimestamp(msg)
    return utcToLocal(utcTime)
end

function timestampToDate(timestamp)
    -- Handle negative timestamps
    if timestamp < 0 then
        error("Timestamps before 1970-01-01 are not supported")
    end

    -- Convert from milliseconds to seconds for date calculation
    local seconds = math.floor(timestamp / 1000)
    local days = math.floor(seconds / 86400)
    local remainingSeconds = seconds % 86400

    -- Calculate year
    local year = 1970
    local daysInYear
    while days > 0 do
        -- Check leap year before subtracting days
        if year % 4 == 0 and (year % 100 ~= 0 or year % 400 == 0) then
            daysInYear = 366
        else
            daysInYear = 365
        end
        if days >= daysInYear then
            days = days - daysInYear
            year = year + 1
        else
            break
        end
    end

    -- Calculate month and day
    local monthDays = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 }
    if year % 4 == 0 and (year % 100 ~= 0 or year % 400 == 0) then
        monthDays[2] = 29
    end

    local month = 1
    local day = days
    for i = 1, 12 do
        if day < monthDays[i] then
            month = i
            day = day + 1
            break
        end
        day = day - monthDays[i]
    end

    -- Calculate time components
    local hour = math.floor(remainingSeconds / 3600)
    local minute = math.floor((remainingSeconds % 3600) / 60)
    local second = remainingSeconds % 60

    return {
        year = year,
        month = month,
        day = day,
        hour = hour,
        minute = minute,
        second = second,
        timestamp = timestamp
    }
end

function dateToTimestamp(year, month, day, hour, minute, second)
    -- Convert date components to Unix timestamp
    hour = hour or 0
    minute = minute or 0
    second = second or 0

    -- Calculate days since Unix epoch (1970-01-01)
    local days = 0

    -- Add days for each year
    for y = 1970, year - 1 do
        if y % 4 == 0 and (y % 100 ~= 0 or y % 400 == 0) then
            days = days + 366 -- Leap year
        else
            days = days + 365 -- Regular year
        end
    end

    -- Add days for months in current year
    local monthDays = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 }
    -- Adjust February for leap years
    if year % 4 == 0 and (year % 100 ~= 0 or year % 400 == 0) then
        monthDays[2] = 29
    end

    for m = 1, month - 1 do
        days = days + monthDays[m]
    end

    -- Add days for current month
    days = days + day - 1

    -- Convert to seconds and add time components
    local seconds = days * 86400 + hour * 3600 + minute * 60 + second
    return seconds * 1000 -- Convert to milliseconds
end

function isToday(timestamp, currentTime)
    local current = currentTime or getCurrentLocalTimestamp()

    -- Use day boundary logic instead of date component comparison
    -- This is more reliable and consistent with the day boundary calculations
    -- Convert to local timezone for day boundary calculations
    local localTimestamp = utcToLocal(timestamp)
    local currentDate = timestampToDate(current)
    local dayStart = dateToTimestamp(currentDate.year, currentDate.month, currentDate.day, 0, 0, 0)
    local dayEnd = dayStart + 86400000 -- 24 hours in milliseconds

    return localTimestamp >= dayStart and localTimestamp < dayEnd
end

function isThisWeek(timestamp, currentTime)
    local current = currentTime or getCurrentLocalTimestamp()

    -- Simple week calculation (7 days from current date)
    local weekStart = current - (7 * 24 * 60 * 60 * 1000)
    local weekEnd = current + (7 * 24 * 60 * 60 * 1000)

    -- Convert to local timezone for comparison
    local localTimestamp = utcToLocal(timestamp)
    return localTimestamp >= weekStart and localTimestamp <= weekEnd
end

function isThisMonth(timestamp, currentTime)
    local current = currentTime or getCurrentLocalTimestamp()

    -- Convert both timestamps to date components and compare month/year
    -- Use local timezone for date calculations
    local currentDate = timestampToDate(current)
    local localTimestamp = utcToLocal(timestamp)
    local eventDate = timestampToDate(localTimestamp)

    return currentDate.year == eventDate.year and currentDate.month == eventDate.month
end

function isNext24Hours(timestamp, currentTime)
    local current = currentTime or getCurrentLocalTimestamp()
    local next24 = current + (24 * 60 * 60 * 1000)

    -- Convert to local timezone for comparison
    local localTimestamp = utcToLocal(timestamp)
    return localTimestamp >= current and localTimestamp <= next24
end

-- Function to format timestamp for display
function formatTimestamp(timestamp)
    if not timestamp then return "Unknown" end

    -- Just return the raw Unix timestamp in milliseconds
    return "Timestamp: " .. timestamp
end

-- Function to format timestamp as readable date
function formatTimestampAsDate(timestamp)
    if not timestamp then return "Unknown" end

    -- Convert timestamp to date components
    local date = timestampToDate(timestamp)

    -- Format as readable date (YYYY-MM-DD HH:MM:SS)
    return string.format("%04d-%02d-%02d %02d:%02d:%02d",
        date.year, date.month, date.day, date.hour, date.minute, date.second)
end

-- Independent function for fetching calendar event info
function getCalendarEvents(options, currentTime)
    options = options or {}
    currentTime = currentTime or (os.time())
    local results = {}

    for id, event in pairs(calendar.events) do
        local include = true

        -- Filter by date range if specified
        if options.startDate and event.startTime < options.startDate then
            include = false
        end
        if options.endDate and event.startTime > options.endDate then
            include = false
        end

        -- Filter by time period if specified
        if options.period then
            if options.period == "today" and not isToday(event.startTime, currentTime) then
                include = false
            elseif options.period == "thisWeek" and not isThisWeek(event.startTime, currentTime) then
                include = false
            elseif options.period == "thisMonth" and not isThisMonth(event.startTime, currentTime) then
                include = false
            elseif options.period == "next24Hours" and not isNext24Hours(event.startTime, currentTime) then
                include = false
            end
        end

        -- Filter by event type if specified
        if options.eventType and event.eventType ~= options.eventType then
            include = false
        end

        if include then
            table.insert(results, event)
        end
    end

    -- Sort by start time
    table.sort(results, function(a, b) return a.startTime < b.startTime end)

    return results
end

-- Handler for listing available timezones
Handlers.add("list-timezones",
    Handlers.utils.hasMatchingTag("Action", "list-timezones"),
    function(msg)
        local timezoneList = {}
        for tz, offset in pairs(TIMEZONE_OFFSETS) do
            local utcOffset = (offset >= 0 and "+" or "") .. (offset / 60) .. " hours"
            table.insert(timezoneList, {
                timezone = tz,
                offset = offset,
                utcOffset = utcOffset
            })
        end

        -- Sort by offset
        table.sort(timezoneList, function(a, b) return a.offset < b.offset end)

        print("🌍 Available timezones:")
        for _, tz in ipairs(timezoneList) do
            print("  " .. tz.timezone .. " (UTC" .. tz.utcOffset .. ")")
        end

        ao.send({
            Target = msg.From,
            Action = "timezones-listed",
            Count = tostring(#timezoneList),
            Timezones = json.encode(timezoneList),
            CurrentTimezone = calendar.timezone,
            CurrentOffset = tostring(calendar.timezoneOffset)
        })
    end
)

-- Handler for setting timezone
Handlers.add("set-timezone",
    Handlers.utils.hasMatchingTag("Action", "set-timezone"),
    function(msg)
        -- Check authorization
        if not isAuthorized(msg) then
            print("❌ Error: Unauthorized access attempt")
            ao.send({
                Target = msg.From,
                Action = "timezone-error",
                Error = "Unauthorized access"
            })
            return
        end

        local newTimezone = msg.Tags["Timezone"]
        local newOffset = tonumber(msg.Tags["Offset"])

        if newTimezone then
            -- Look up the timezone offset from our conversion table
            local lookupOffset = TIMEZONE_OFFSETS[newTimezone:upper()]

            if lookupOffset then
                -- Use the lookup offset if no manual offset provided
                if not newOffset then
                    newOffset = lookupOffset
                    print("📅 Auto-detected timezone offset: " .. newOffset .. " minutes")
                end

                calendar.timezone = newTimezone:upper()
                calendar.timezoneOffset = newOffset

                print("✅ Timezone updated:")
                print("  Timezone: " .. calendar.timezone)
                print("  Offset: " .. calendar.timezoneOffset .. " minutes")
                print("  UTC" .. (newOffset >= 0 and "+" or "") .. (newOffset / 60) .. " hours")

                -- Send confirmation back
                ao.send({
                    Target = msg.From,
                    Action = "timezone-updated",
                    Timezone = calendar.timezone,
                    Offset = tostring(calendar.timezoneOffset),
                    UTCOffset = (newOffset >= 0 and "+" or "") .. (newOffset / 60) .. " hours"
                })
            else
                print("❌ Error: Unknown timezone: " .. newTimezone)
                ao.send({
                    Target = msg.From,
                    Action = "timezone-error",
                    Error = "Unknown timezone: " .. newTimezone,
                    AvailableTimezones = json.encode(TIMEZONE_OFFSETS)
                })
            end
        else
            print("❌ Error: No timezone specified")
            ao.send({
                Target = msg.From,
                Action = "timezone-error",
                Error = "No timezone specified"
            })
        end
    end
)

-- Handler for adding calendar events
Handlers.add("add-event",
    Handlers.utils.hasMatchingTag("Action", "add-event"),
    function(msg)
        -- Check authorization
        if not isAuthorized(msg) then
            print("❌ Error: Unauthorized access attempt")
            ao.send({
                Target = msg.From,
                Action = "add-event-error",
                Error = "Unauthorized access"
            })
            return
        end

        local eventName = msg.Tags["Event-Name"]
        local startTime = tonumber(msg.Tags["Start-Time"])
        local endTime = tonumber(msg.Tags["End-Time"])
        local isAllDay = msg.Tags["Is-All-Day"] == "true"
        local description = msg.Tags["Description"] or ""
        local eventType = msg.Tags["Event-Type"] or "general"
        local location = msg.Tags["Location"] or ""
        local priority = msg.Tags["Priority"] or "medium"

        if not eventName or not startTime then
            print("❌ Error: Missing required event information")
            ao.send({
                Target = msg.From,
                Action = "add-event-error",
                Error = "Missing required event information"
            })
            return
        end

        -- Create new event
        local newEvent = {
            id = calendar.nextEventId,
            eventName = eventName,
            startTime = startTime,
            endTime = endTime or startTime,
            isAllDay = isAllDay,
            description = description,
            eventType = eventType,
            location = location,
            priority = priority,
            createdAt = getCurrentTimestamp(msg),
            createdBy = msg.From
        }

        -- Add to calendar
        calendar.events[calendar.nextEventId] = newEvent
        calendar.nextEventId = calendar.nextEventId + 1

        print("✅ Event added:")
        print("  ID: " .. newEvent.id)
        print("  Name: " .. newEvent.eventName)
        print("  Start: " .. formatTimestamp(startTime))
        print("  All Day: " .. tostring(newEvent.isAllDay))

        -- Send confirmation back
        ao.send({
            Target = msg.From,
            Action = "event-added",
            EventId = tostring(newEvent.id),
            EventName = newEvent.eventName,
            StartTime = tostring(newEvent.startTime)
        })
    end
)

-- Handler for editing calendar events
Handlers.add("edit-event",
    Handlers.utils.hasMatchingTag("Action", "edit-event"),
    function(msg)
        -- Check authorization
        if not isAuthorized(msg) then
            print("❌ Error: Unauthorized access attempt")
            ao.send({
                Target = msg.From,
                Action = "edit-event-error",
                Error = "Unauthorized access"
            })
            return
        end

        local eventId = tonumber(msg.Tags["Event-Id"])

        if not eventId or not calendar.events[eventId] then
            print("❌ Error: Event not found")
            ao.send({
                Target = msg.From,
                Action = "edit-event-error",
                Error = "Event not found"
            })
            return
        end

        local event = calendar.events[eventId]

        -- Update fields if provided
        if msg.Tags["Event-Name"] then event.eventName = msg.Tags["Event-Name"] end
        if msg.Tags["Start-Time"] then event.startTime = tonumber(msg.Tags["Start-Time"]) end
        if msg.Tags["End-Time"] then event.endTime = tonumber(msg.Tags["End-Time"]) end
        if msg.Tags["Is-All-Day"] then event.isAllDay = msg.Tags["Is-All-Day"] == "true" end
        if msg.Tags["Description"] then event.description = msg.Tags["Description"] end
        if msg.Tags["Event-Type"] then event.eventType = msg.Tags["Event-Type"] end
        if msg.Tags["Location"] then event.location = msg.Tags["Location"] end
        if msg.Tags["Priority"] then event.priority = msg.Tags["Priority"] end

        event.modifiedAt = getCurrentTimestamp(msg)
        event.modifiedBy = msg.From

        print("✅ Event updated:")
        print("  ID: " .. event.id)
        print("  Name: " .. event.eventName)
        print("  Start: " .. formatTimestamp(event.startTime))

        -- Send confirmation back
        ao.send({
            Target = msg.From,
            Action = "event-updated",
            EventId = tostring(event.id),
            EventName = event.eventName
        })
    end
)

-- Handler for removing calendar events
Handlers.add("remove-event",
    Handlers.utils.hasMatchingTag("Action", "remove-event"),
    function(msg)
        -- Check authorization
        if not isAuthorized(msg) then
            print("❌ Error: Unauthorized access attempt")
            ao.send({
                Target = msg.From,
                Action = "remove-event-error",
                Error = "Unauthorized access"
            })
            return
        end

        local eventId = tonumber(msg.Tags["Event-Id"])

        if not eventId or not calendar.events[eventId] then
            print("❌ Error: Event not found")
            ao.send({
                Target = msg.From,
                Action = "remove-event-error",
                Error = "Event not found"
            })
            return
        end

        local eventName = calendar.events[eventId].eventName

        -- Remove event
        calendar.events[eventId] = nil

        print("✅ Event removed:")
        print("  ID: " .. eventId)
        print("  Name: " .. eventName)

        -- Send confirmation back
        ao.send({
            Target = msg.From,
            Action = "event-removed",
            EventId = tostring(eventId),
            EventName = eventName
        })
    end
)

-- Handler for getting calendar information
Handlers.add("get-events",
    Handlers.utils.hasMatchingTag("Action", "get-events"),
    function(msg)
        local period = msg.Tags["Period"] -- today, thisWeek, thisMonth, next24Hours, all
        local startDate = tonumber(msg.Tags["Start-Date"])
        local endDate = tonumber(msg.Tags["End-Date"])
        local eventType = msg.Tags["Event-Type"]
        local limit = tonumber(msg.Tags["Limit"]) or 50

        local options = {
            period = period,
            startDate = startDate,
            endDate = endDate,
            eventType = eventType
        }

        local events = getCalendarEvents(options, getCurrentTimestamp(msg))

        -- Limit results
        if #events > limit then
            events = { table.unpack(events, 1, limit) }
        end

        print("📅 Retrieved " .. #events .. " events")
        if period then
            print("  Period: " .. period)
        end

        -- Send events back
        ao.send({
            Target = msg.From,
            Action = "events-retrieved",
            Count = tostring(#events),
            Period = period or "custom",
            Events = json.encode(events)
        })
    end
)

-- Handler for getting calendar statistics
Handlers.add("get-calendar-stats",
    Handlers.utils.hasMatchingTag("Action", "get-calendar-stats"),
    function(msg)
        local currentTime = getCurrentTimestamp(msg)
        local totalEvents = 0
        local todayEvents = 0
        local thisWeekEvents = 0
        local thisMonthEvents = 0
        local upcomingEvents = 0

        for _, event in pairs(calendar.events) do
            totalEvents = totalEvents + 1

            if isToday(event.startTime, currentTime) then
                todayEvents = todayEvents + 1
            end

            if isThisWeek(event.startTime, currentTime) then
                thisWeekEvents = thisWeekEvents + 1
            end

            if isThisMonth(event.startTime, currentTime) then
                thisMonthEvents = thisMonthEvents + 1
            end

            if event.startTime > currentTime then
                upcomingEvents = upcomingEvents + 1
            end
        end

        local stats = {
            totalEvents = totalEvents,
            todayEvents = todayEvents,
            thisWeekEvents = thisWeekEvents,
            thisMonthEvents = thisMonthEvents,
            upcomingEvents = upcomingEvents,
            timezone = calendar.timezone,
            timezoneOffset = calendar.timezoneOffset
        }

        print("📊 Calendar statistics:")
        print("  Total Events: " .. totalEvents)
        print("  Today: " .. todayEvents)
        print("  This Week: " .. thisWeekEvents)
        print("  This Month: " .. thisMonthEvents)
        print("  Upcoming: " .. upcomingEvents)

        -- Send statistics back
        ao.send({
            Target = msg.From,
            Action = "calendar-stats",
            Stats = json.encode(stats)
        })
    end
)

-- Handler for clearing all events
Handlers.add("clear-calendar",
    Handlers.utils.hasMatchingTag("Action", "clear-calendar"),
    function(msg)
        -- Check authorization
        if not isAuthorized(msg) then
            print("❌ Error: Unauthorized access attempt")
            ao.send({
                Target = msg.From,
                Action = "clear-calendar-error",
                Error = "Unauthorized access"
            })
            return
        end

        local eventCount = 0
        for _ in pairs(calendar.events) do
            eventCount = eventCount + 1
        end

        calendar.events = {}
        calendar.nextEventId = 1

        print("🗑️ Calendar cleared:")
        print("  Removed " .. eventCount .. " events")

        -- Send confirmation back
        ao.send({
            Target = msg.From,
            Action = "calendar-cleared",
            EventsRemoved = tostring(eventCount)
        })
    end
)

-- Handler for listing all events (for debugging)
Handlers.add("list-all-events",
    Handlers.utils.hasMatchingTag("Action", "list-all-events"),
    function(msg)
        print("📋 All calendar events:")

        if next(calendar.events) == nil then
            print("  No events found")
            ao.send({
                Target = msg.From,
                Action = "events-listed",
                Count = "0",
                Message = "No events found"
            })
            return
        end

        local eventList = {}
        for id, event in pairs(calendar.events) do
            local eventInfo = {
                id = event.id,
                eventName = event.eventName,
                startTime = event.startTime,
                isAllDay = event.isAllDay,
                eventType = event.eventType
            }
            table.insert(eventList, eventInfo)

            print("  " .. event.id .. ": " .. event.eventName ..
                " (" .. formatTimestamp(event.startTime) .. ")")
        end

        -- Send event list back
        ao.send({
            Target = msg.From,
            Action = "events-listed",
            Count = tostring(#eventList),
            Events = json.encode(eventList)
        })
    end
)

-- Handler for debugging timestamps and time range calculations
Handlers.add("Debug-Timestamps",
    Handlers.utils.hasMatchingTag("Action", "Debug-Timestamps"),
    function(msg)
        print("🔍 Debug-Timestamps: Starting timestamp analysis...")

        local currentTime = os.time()
        local currentLocalTime = getCurrentLocalTimestamp()
        local currentDate = timestampToDate(currentLocalTime)

        print("📅 Current timestamp analysis:")
        print("  Raw os.time() (UTC): " .. currentTime)
        print("  Current local timestamp: " .. currentLocalTime)
        print("  Timezone: " ..
            calendar.timezone ..
            " (UTC" .. (calendar.timezoneOffset >= 0 and "+" or "") .. (calendar.timezoneOffset / 60) .. " hours)")
        print("  Converted local date: " ..
            currentDate.year ..
            "-" ..
            currentDate.month ..
            "-" .. currentDate.day .. " " .. currentDate.hour .. ":" .. currentDate.minute .. ":" .. currentDate.second)

        -- Test day boundary calculations (in local timezone)
        local dayStart = dateToTimestamp(currentDate.year, currentDate.month, currentDate.day, 0, 0, 0)
        local dayEnd = dayStart + 86400000 -- 24 hours in milliseconds

        print("📅 Day boundary calculations (Local Timezone):")
        print("  Day start (ms): " .. dayStart)
        print("  Day end (ms): " .. dayEnd)
        print("  Day start date: " .. formatTimestampAsDate(dayStart))
        print("  Day end date: " .. formatTimestampAsDate(dayEnd))

        -- Test time range functions
        print("⏰ Time range function tests:")
        print("  isToday test:")
        for id, event in pairs(calendar.events) do
            local todayResult = isToday(event.startTime, currentLocalTime)
            local weekResult = isThisWeek(event.startTime, currentLocalTime)
            local monthResult = isThisMonth(event.startTime, currentLocalTime)
            local next24Result = isNext24Hours(event.startTime, currentLocalTime)

            -- Convert event time to local for display
            local localEventTime = utcToLocal(event.startTime)
            local localEventDate = timestampToDate(localEventTime)

            print("    Event: " .. event.eventName .. " (ID: " .. id .. ")")
            print("      UTC start time: " .. event.startTime .. " (" .. formatTimestampAsDate(event.startTime) .. ")")
            print("      Local start time: " .. localEventTime .. " (" .. formatTimestampAsDate(localEventTime) .. ")")
            print("      isToday: " .. tostring(todayResult))
            print("      isThisWeek: " .. tostring(weekResult))
            print("      isThisMonth: " .. tostring(monthResult))
            print("      isNext24Hours: " .. tostring(next24Result))
            print("      Within day boundaries: " .. tostring(localEventTime >= dayStart and localEventTime < dayEnd))
        end

        -- Send debug results back
        ao.send({
            Target = msg.From,
            Action = "debug-timestamps-complete",
            CurrentTime = tostring(currentTime),
            CurrentLocalTime = tostring(currentLocalTime),
            Timezone = calendar.timezone,
            TimezoneOffset = tostring(calendar.timezoneOffset),
            CurrentDate = json.encode(currentDate),
            DayStart = tostring(dayStart),
            DayEnd = tostring(dayEnd),
            DayStartDate = formatTimestampAsDate(dayStart),
            DayEndDate = formatTimestampAsDate(dayEnd),
            EventCount = tostring(#calendar.events)
        })

        print("✅ Debug-Timestamps: Analysis complete")
    end
)

-- Export the getCalendarEvents function for use by other modules
return {
    getCalendarEvents = getCalendarEvents,
    calendar = calendar
}
