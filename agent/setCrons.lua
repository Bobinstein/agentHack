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

local crons =  {
    ["cron-daily-email"] = {
        ["Interval"] = 1000 * 60 * 60 * 24,
        ["Action"] = "cron-daily-email",
        ["XTags"] = {
            ["Email-To"] = "stephen@gigautility.com",
            ["Email-Name"] = "Stephen"
        }
    },

    ["set-hourly-weather"] = {
        ["Interval"] = 1000 * 60 * 60,
        ["Action"] = "set-hourly-weather",
    },

    ["set-daily-weather"] = {
        ["Interval"] = 1000 * 60 * 60 * 24,
        ["Action"] = "set-daily-weather",
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
