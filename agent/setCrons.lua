--[[
  AgentHack - SetCrons Module
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

CrontrollerProcessId = CrontrollerProcessId or ""

Handlers.add("Set-Crontroller", Handlers.utils.hasMatchingTag("Action", "Set-Crontroller"), function(msg)
    if not msg.From == Owner then
        print("❌ Error: Unauthorized access attempt")
        return
    end
    if msg["Controller-Id"] then
        CrontrollerProcessId = msg["Controller-Id"]
    else
        print("❌ Error: No Controller-Id provided")
        return
    end
    print("Set-Crontroller: CrontrollerProcessId set to " .. CrontrollerProcessId)
end)

local crons = {
    ["cron-daily-email"] = {
        ["Interval"] = 1000 * 60 * 60 * 24,
        ["Action"] = "cron-daily-email",
        ["XTags"] = {
            ["Email-To"] = "preConfiguredEmailAddress",
            ["Email-Name"] = "preConfiguredEmailName"
        }
    },

    ["set-hourly-weather"] = {
        ["Interval"] = 1000 * 60 * 60,
        ["Action"] = "set-hourly-weather",
        ["XTags"] = {
            ["X-Request-Type"] = "hourly",
        }
        
    },

    ["set-daily-weather"] = {
        ["Interval"] = 1000 * 60 * 60 * 24,
        ["Action"] = "set-daily-weather",
        ["XTags"] = {
            ["X-Request-Type"] = "daily",
    },
    ["cron-request-csvs"] = {
        ["Interval"] = 1000 * 60 * 60 * 12,
        ["Action"] = "cron-request-csvs",
    },
    ["cron-fetch-all-token-prices"] = {
        ["Interval"] = 1000 * 60 * 60 * 6,
        ["Action"] = "cron-fetch-all-token-prices",
    },
    ["cron-request-token-balances"] = {
        ["Interval"] = 1000 * 60 * 60 * 12,
        ["Action"] = "cron-request-token-balances",
    },
}

Handlers.add(
    "trigger-set-crons",
    Handlers.utils.hasMatchingTag("Action", "trigger-set-crons"),
    function(msg)
        print("trigger-set-crons received for " .. msg.From)
        for name, cron in pairs(crons) do
            print("trigger-set-crons: Adding cron " .. name)

            local message = {
                Target = CrontrollerProcessId,
                Action = "Add-Cron",
                Name = name,
                Interval = tostring(cron.Interval),
                ["Cron-Action"] = cron.Action
            }

            if cron["XTags"] then
                message.XTags = json.encode(cron["XTags"])
                print("trigger-set-crons: Adding XTags for " .. name .. ": " .. message.XTags)
            else
                print("trigger-set-crons: No XTags for " .. name)
            end

            print("trigger-set-crons: Sending message: " .. json.encode(message))
            ao.send(message)
        end
    end
)

return crons
