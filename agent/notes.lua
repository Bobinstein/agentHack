Note = Note or ""


local function isAuthorized(msg)
    return msg.From == Owner or msg.From == CrontrollerProcessId
end

Handlers.add("Set-note", Handlers.utils.hasMatchingTag("Action", "Set-note"), function(msg)
    if not isAuthorized(msg) then
        print("❌ Error: Unauthorized access attempt")
        return
    end
    Note = msg.Data
end)

function getNote()
    return Note
end

Handlers.add("Get-note", Handlers.utils.hasMatchingTag("Action", "Get-note"), function(msg)
    if not isAuthorized(msg) then
        print("❌ Error: Unauthorized access attempt")
        return
    end
    ao.send({ Target = msg.From, Action = "Get-note-response", Data = getNote() })
end)



return Note