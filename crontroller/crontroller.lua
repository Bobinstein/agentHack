--[[
  AgentHack - Crontroller Module
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

cronList = cronList or {}

function addCron(name, interval, processId, action, xTags)
    -- Initialize processId table if it doesn't exist
    if not cronList[processId] then
        cronList[processId] = {}
    end

    if cronList[processId][name] then
        print("Cron already exists: " .. name)
        return
    end

    cronList[processId][name] = {
        interval = tonumber(interval),
        processId = processId,
        action = action,
        xTags = xTags,
        lastRun = nil
    }

    return true
end

function removeCron(name, processId)
    -- Initialize processId table if it doesn't exist
    if not cronList[processId] then
        cronList[processId] = {}
        return false
    end

    if not cronList[processId][name] then
        print("Cron not found: " .. name)
        return false
    end

    cronList[processId][name] = nil

    -- Clean up empty processId table
    if next(cronList[processId]) == nil then
        cronList[processId] = nil
    end

    return true
end

function getCron(name, processId)
    if not cronList[processId] then
        return nil
    end
    return cronList[processId][name]
end

function getCrons(processId)
    if not cronList[processId] then
        return {}
    end
    return cronList[processId]
end

function shouldRunCron(name, processId)
    local cron = getCron(name, processId)
    if not cron then
        return false
    end

    if not cron["lastRun"] then
        print("shouldRunCron: " .. name .. " - first run, returning true")
        return true
    end

    local now = os.time()
    local timeSinceLastRun = now - cron["lastRun"]
    local shouldRun = timeSinceLastRun >= cron["interval"]

    print("shouldRunCron: " ..
        name ..
        " - now: " ..
        now ..
        ", lastRun: " ..
        cron["lastRun"] ..
        ", timeSinceLastRun: " ..
        timeSinceLastRun .. ", interval: " .. cron["interval"] .. ", shouldRun: " .. tostring(shouldRun))

    return shouldRun
end

Handlers.add(
    "Add-Cron",
    Handlers.utils.hasMatchingTag("Action", "Add-Cron"),
    function(msg)
        -- Validate required fields
        if not msg.Name or not msg.Interval or not msg["Cron-Action"] then
            print("Add-Cron: Missing required fields")
            return
        end
        -- print(msg)

        print("Add-Cron received for " .. msg.From .. " with name " .. msg.Name .. " and interval " .. msg.Interval)

        -- Safely decode XTags with error handling
        local xTags = nil
        if msg.Xtags and msg.Xtags ~= "" then
            local success, result = pcall(json.decode, msg.Xtags)
            if success then
                xTags = result
                print("Add-Cron: XTags decoded successfully: " .. json.encode(xTags))
            else
                print("Add-Cron: Invalid XTags JSON: " .. tostring(result))
                return
            end
        else
            print("Add-Cron: No XTags provided")
        end

        addCron(msg.Name, tonumber(msg.Interval), msg.From, msg["Cron-Action"], xTags)

        print("Cron added for " .. msg.From .. " with name " .. msg.Name .. " and interval " .. msg.Interval)

        ao.send({ Target = msg.From, Action = "Add-Cron-Response", Data = "Cron added" })
    end
)

Handlers.add(
    "Remove-Cron",
    Handlers.utils.hasMatchingTag("Action", "Remove-Cron"),
    function(msg)
        -- Validate required fields
        if not msg.Name then
            print("Remove-Cron: Missing Name field")
            return
        end

        print("Remove-Cron received for " .. msg.From .. " with name " .. msg.Name)

        removeCron(msg.Name, msg.From)

        print("Cron removed for " .. msg.From .. " with name " .. msg.Name)

        ao.send({ Target = msg.From, Action = "Remove-Cron-Response", Data = "Cron removed" })
    end
)

Handlers.add(
    "Get-Crons",
    Handlers.utils.hasMatchingTag("Action", "Get-Crons"),
    function(msg)
        print("Get-Crons received for " .. msg.From)

        local userCrons = json.encode(getCrons(msg.From))

        ao.send({ Target = msg.From, Action = "Get-Cron-Response", Data = userCrons })
    end
)

Handlers.add(
    "Cron-Tick",
    Handlers.utils.hasMatchingTag("Action", "Cron"),
    function(msg)
        -- print("Cron-Tick received for " .. msg.From)

        -- Collect crons that should run first to avoid modifying table during iteration
        local cronsToRun = {}
        for processId, processCrons in pairs(cronList) do
            for name, cron in pairs(processCrons) do
                if shouldRunCron(name, processId) then
                    table.insert(cronsToRun, { processId = processId, name = name, cron = cron })
                end
            end
        end

        -- Execute crons separately to avoid table modification during iteration
        for _, cronData in pairs(cronsToRun) do
            local processId = cronData.processId
            local name = cronData.name
            local cron = cronData.cron

            local xTags = cron["xTags"]
            local action = cron["action"]

            -- Build the base message
            local message = {
                Target = processId,
                Action = action
            }

            -- Add xTags to the message if they exist
            if xTags and type(xTags) == "table" then
                -- Check if xTags is an array of objects or a single object
                if #xTags > 0 then
                    -- Array format: [{"key": "value"}, {"key2": "value2"}]
                    print("Cron-Tick: Processing " .. #xTags .. " xTags for cron " .. name)
                    for _, xTag in pairs(xTags) do
                        if type(xTag) == "table" then
                            for key, value in pairs(xTag) do
                                message[key] = value
                                print("Cron-Tick: Added xTag " .. key .. " = " .. tostring(value))
                            end
                        end
                    end
                else
                    -- Single object format: {"key": "value", "key2": "value2"}
                    print("Cron-Tick: Processing single xTags object for cron " .. name)
                    for key, value in pairs(xTags) do
                        message[key] = value
                        print("Cron-Tick: Added xTag " .. key .. " = " .. tostring(value))
                    end
                end
            else
                print("Cron-Tick: No xTags to process for cron " .. name)
            end

            ao.send(message)

            local currentTime = os.time()
            cron["lastRun"] = currentTime
            print("Cron-Tick: Set lastRun for " ..
                name .. " to " .. currentTime .. " (interval: " .. cron["interval"] .. ")")
        end
    end
)
