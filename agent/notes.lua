--[[
  AgentHack - Notes Module
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
