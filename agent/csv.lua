--[[
  AgentHack - CSV Module
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

csv = {}
local json = require("json")
local bint = require(".bint")(256)

LastDist = LastDist or {}

function csv.findRowByString(csvString, searchString)
  -- Validate inputs
  assert(type(csvString) == 'string', 'CSV input must be a string')
  assert(type(searchString) == 'string', 'Search string must be a string')

  -- Split by lines
  local lines = {}
  for line in csvString:gmatch("[^\r\n]+") do
    table.insert(lines, line)
  end

  -- Split each line by commas into a row table
  local rows = Utils.map(function(line)
    local row = {}
    for field in line:gmatch("[^,]+") do
      table.insert(row, field)
    end
    return row
  end, lines)

  -- Search for the row where the first column matches searchString
  for _, row in ipairs(rows) do
    if row[1] == searchString and (#row == 2 or #row == 4) then
      return row
    end
  end

  -- Return nil if no match is found
  return nil
end

csv.parseAo = function(msg)
  print("csv-parse-ao received for " .. msg.From)

  local csvString = msg.Data
  local searchString = Owner
  local row = csv.findRowByString(csvString, searchString)

  if not row then
    print("No row found")
    return
  end

  if row and row[4] == "AO" then
    if not LastDist["AO"] then LastDist["AO"] = {} end
    LastDist["AO"]["raw"] = row[2]
    LastDist["AO"]["parsed"] = string.format("%.12f", bint(row[2]) / bint("1000000000000"))
    LastDist["AO"]["LastUpdated"] = msg.Timestamp
  end
  print(json.encode(row))
  print(json.encode(LastDist))
end

Handlers.add("csv-parse-ao", Handlers.utils.hasMatchingTag("Action", "csv-parse-ao"), function(msg) csv.parseAo(msg) end)

csv.parsePi = function(msg)
  print("csv-parse-pi received for " .. msg.From)

  local csvString = msg.Data
  local searchString = Owner
  local row = csv.findRowByString(csvString, searchString)

  if not row then
    print("No row found")
    return
  end

  if #row == 2 then
    if not LastDist["PI"] then LastDist["PI"] = {} end
    LastDist["PI"]["raw"] = row[2]
    LastDist["PI"]["parsed"] = string.format("%.12f", bint(row[2]) / bint("1000000000000"))
    LastDist["PI"]["LastUpdated"] = msg.Timestamp
  end
  print(json.encode(row))
  print(json.encode(LastDist))
end

Handlers.add("csv-parse-pi", Handlers.utils.hasMatchingTag("Action", "csv-parse-pi"), function(msg)
  csv.parsePi(msg)
end)

Handlers.add("cron-request-csvs",
  Handlers.utils.hasMatchingTag("Action", "cron-request-csvs"),
  function(msg)
    print("🔄 cron-request-csvs: Starting CSV distribution requests...")

    local AOTokenProcess = "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc"
    local AOMintProcess = "NTE-RcHEeO15MYMUbXwWytRxn_IUJmXPKPOFVc5qZcg"
    local PITokenProcess = "4hXj_E-5fAKmo4E8KjgQvuDJKAFk9P2grhycVmISDLs"
    local PIMintProcess = "rxxU4g-7tUHGvF28W2l53hxarpbaFR4NaSnOaxx6MIE"

    -- AO Distribution CSV Query
    local aoQuery = [[
query {
  transactions(
    recipients: ["0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc"]
    tags: [
      { name: "Action", values: ["Mint"] }
      { name: "Data-Protocol", values: ["ao"] }
      { name: "From-Process", values: ["NTE-RcHEeO15MYMUbXwWytRxn_IUJmXPKPOFVc5qZcg"] }
    ]
    first: 1
    sort: HEIGHT_DESC
  ) {
    edges {
      node {
        id
        block { height timestamp }
        data { size }
      }
    }
  }
}]]

    -- PI Distribution CSV Query
    local piQuery = [[
query {
  transactions(
    recipients: ["4hXj_E-5fAKmo4E8KjgQvuDJKAFk9P2grhycVmISDLs"]
    tags: [
      { name: "Action", values: ["Mint"] }
      { name: "Data-Protocol", values: ["ao"] }
      { name: "From-Process", values: ["rxxU4g-7tUHGvF28W2l53hxarpbaFR4NaSnOaxx6MIE"] }
    ]
    first: 1
    sort: HEIGHT_DESC
  ) {
    edges {
      node {
        id
        block { height timestamp }
        data { size }
      }
    }
  }
}]]

    -- Send AO Distribution CSV Request
    print("📊 Requesting AO distribution CSV...")
    ao.send({
      Target = RelayProcessId,
      Action = "Relay-Request",
      ["Request-URL"] = "https://arweave.net/graphql",
      Method = "POST",
      Headers = json.encode({
        ["Content-Type"] = "application/json"
      }),
      Data = json.encode({
        query = aoQuery
      }),
      Timeout = "30000",
      ["X-Request-Type"] = "ao-distribution-csv-request",
      ["X-Token-Type"] = "AO",
      ["X-Target-Process"] = AOTokenProcess,
      ["X-Mint-Process"] = AOMintProcess
    })

    -- Send PI Distribution CSV Request
    print("🥧 Requesting PI distribution CSV...")
    ao.send({
      Target = RelayProcessId,
      Action = "Relay-Request",
      ["Request-URL"] = "https://arweave.net/graphql",
      Method = "POST",
      Headers = json.encode({
        ["Content-Type"] = "application/json"
      }),
      Data = json.encode({
        query = piQuery
      }),
      Timeout = "30000",
      ["X-Request-Type"] = "pi-distribution-csv-request",
      ["X-Token-Type"] = "PI",
      ["X-Target-Process"] = PITokenProcess,
      ["X-Mint-Process"] = PIMintProcess
    })

    print("✅ Both CSV distribution requests sent successfully")
    print("   - AO: " .. AOTokenProcess)
    print("   - PI: " .. PITokenProcess)
  end
)

return csv
