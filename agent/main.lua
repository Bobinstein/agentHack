local json = require("json")
require("calendar")
require("weather")
require("emails")
require("setCrons")
require("csv")
require("tokens")
require("notes")

-- Store chunked relay responses temporarily with dedicated tracking
local chunkedRelayResponses = {}

-- Store processed CSV transaction IDs to avoid duplicates
local processedCsvs = {}

--[[
    Main relay result processing function that handles all types of relay responses.
    This function centralizes the logic for processing different request types and
    routes them to appropriate handlers.

    Parameters:
    - msg: The relay message containing data and tags
    - requestId: Unique identifier for the relay request
    - status: Status of the relay request (Success/Error)
    - httpStatus: HTTP status code if applicable
    - httpStatusText: HTTP status text if applicable
--]]
local function relayResultAction(msg, requestId, status, httpStatus, httpStatusText)
    -- Try to JSON decode the data first for processing
    local success, parsedData = pcall(json.decode, msg.Data or "")

    -- Handle token price fetch responses
    if msg.Tags["X-Request-Type"] == "token-price-fetch" then
        print("📊 Token price fetch response received, processing...")
        processTokenPriceResponse(msg)
        return
    end

    -- Handle CSV distribution request handlers (consolidated logic)
    local csvRequestTypes = {
        ["ao-distribution-csv-request"] = { tokenType = "AO", relayId = "L7ZEASGMlsjY2AMpTwbX178slBpaHJJxznWN8oywiZY" },
        ["pi-distribution-csv-request"] = { tokenType = "PI", relayId = "L7ZEASGMlsjY2AMpTwbX178slBjaHJJxznWN8oywiZY" }
    }

    local csvConfig = csvRequestTypes[msg.Tags["X-Request-Type"]]
    if csvConfig then
        print("📊 " .. csvConfig.tokenType .. " distribution CSV request received, triggering CSV fetch")

        -- Parse GraphQL response to get CSV transaction ID
        if msg.Data and msg.Data ~= "" then
            if success and parsedData.data and parsedData.data.data and parsedData.data.data.transactions then
                local transactions = parsedData.data.data.transactions.edges
                if #transactions > 0 then
                    local csvTxId = transactions[1].node.id
                    local blockHeight = transactions[1].node.block.height
                    local blockTimestamp = transactions[1].node.block.timestamp

                    print("📊 CSV transaction found: " .. csvTxId)

                    -- Trigger CSV fetch
                    ao.send({
                        Target = csvConfig.relayId,
                        Action = "Relay-Request",
                        ["Request-URL"] = "https://arweave.net/" .. csvTxId,
                        Method = "GET",
                        Headers = json.encode({
                            ["Accept"] = "text/csv,text/plain,application/json"
                        }),
                        Timeout = "30000",
                        ["X-Request-Type"] = "csv-data-fetch",
                        ["X-Csv-Request-Type"] = csvConfig.tokenType:lower() .. "-distribution-csv",
                        ["X-Token-Type"] = csvConfig.tokenType,
                        ["X-Csv-TxId"] = csvTxId,
                        ["X-Block-Height"] = tostring(blockHeight),
                        ["X-Block-Timestamp"] = tostring(blockTimestamp)
                    })

                    print("📊 CSV fetch request sent for " .. csvConfig.tokenType)
                end
            end
        end
        return
    end

    -- Handle direct CSV parsing (from chunked data)
    if msg.Tags["X-Request-Type"] == "ao-distribution-csv" then
        csv.parseAo(msg)
        return
    end

    if msg.Tags["X-Request-Type"] == "pi-distribution-csv" then
        csv.parsePi(msg)
        return
    end

    -- Handle CSV data fetch responses
    if msg.Tags["X-Request-Type"] == "csv-data-fetch" then
        print("📊 Processing CSV data fetch response")

        local csvRequestType = msg.Tags["X-Csv-Request-Type"]
        local tokenType = msg.Tags["X-Token-Type"]
        local csvTxId = msg.Tags["X-Csv-TxId"]
        local blockHeight = msg.Tags["X-Block-Height"]
        local blockTimestamp = msg.Tags["X-Block-Timestamp"]

        -- Check if we received CSV data
        if msg.Data and msg.Data ~= "" then
            print("📊 CSV data received, length: " .. #msg.Data .. " characters")

            -- Mark this CSV as processed to avoid duplicates
            if not processedCsvs then processedCsvs = {} end

            -- Handle case where csvTxId might be nil
            if csvTxId then
                local csvKey = csvRequestType .. "_" .. csvTxId
                processedCsvs[csvKey] = {
                    processedAt = os.time(),
                    blockHeight = blockHeight,
                    blockTimestamp = blockTimestamp,
                    dataLength = #msg.Data
                }
                print("📊 CSV marked as processed: " .. csvKey)
            else
                print("⚠️ Warning: csvTxId is nil, cannot mark as processed")
            end

            -- Parse the CSV data based on token type
            if csvRequestType == "ao-distribution-csv" then
                print("📊 Parsing AO distribution CSV...")
                csv.parseAo(msg)
            elseif csvRequestType == "pi-distribution-csv" then
                print("🥧 Parsing PI distribution CSV...")
                csv.parsePi(msg)
            end
        else
            print("📊 No CSV data received in response")
        end

        return
    end

    -- Handle CSV distribution responses (from chunked data with GraphQL structure)
    if msg.Tags["X-Request-Type"] == "ao-distribution-csv" or msg.Tags["X-Request-Type"] == "pi-distribution-csv" then
        local csvRequestType = msg.Tags["X-Request-Type"]
        print("📊 Processing CSV distribution response: " .. csvRequestType)

        -- Check if we have GraphQL data
        if success and parsedData.data and parsedData.data.data and parsedData.data.data.transactions then
            local transactions = parsedData.data.data.transactions.edges
            if #transactions > 0 then
                local csvTxId = transactions[1].node.id
                local blockHeight = transactions[1].node.block.height
                local blockTimestamp = transactions[1].node.block.timestamp

                print("📊 CSV transaction found: " .. csvTxId)

                -- Check if we've already processed this CSV
                local csvKey = csvRequestType .. "_" .. csvTxId
                if not processedCsvs then processedCsvs = {} end

                if processedCsvs[csvKey] then
                    print("📊 CSV already processed, skipping: " .. csvKey)
                else
                    print("📊 Fetching CSV data from transaction: " .. csvTxId)

                    -- Determine token type from request type
                    local tokenType = (csvRequestType == "ao-distribution-csv") and "AO" or "PI"
                    local relayId = (tokenType == "AO") and "L7ZEASGMlsjY2AMpTwbX178slBpaHJJxznWN8oywiZY" or
                        "L7ZEASGMlsjY2AMpTwbX178slBjaHJJxznWN8oywiZY"

                    -- Make relay request to fetch the actual CSV data
                    ao.send({
                        Target = relayId,
                        Action = "Relay-Request",
                        ["Request-URL"] = "https://arweave.net/" .. csvTxId,
                        Method = "GET",
                        Headers = json.encode({
                            ["Accept"] = "text/csv,text/plain,application/json"
                        }),
                        Timeout = "30000",
                        ["X-Request-Type"] = "csv-data-fetch",
                        ["X-Csv-Request-Type"] = csvRequestType,
                        ["X-Token-Type"] = tokenType,
                        ["X-Csv-TxId"] = csvTxId,
                        ["X-Block-Height"] = tostring(blockHeight),
                        ["X-Block-Timestamp"] = tostring(blockTimestamp)
                    })

                    print("📊 CSV data fetch request sent")
                end
            else
                print("📊 No CSV transactions found in GraphQL response")
            end
        else
            print("📊 No valid GraphQL data structure in response")
        end
        return
    end

    -- Handle weather requests
    local isWeatherRequest = msg.Tags["X-Weather-Request"] == "true"
    if isWeatherRequest then
        print("🌤️ Processing weather relay result")

        -- Check if this is an error response
        if status == "Error" then
            print("❌ Weather relay request failed")

            -- Extract weather-specific tags for error handling
            local requestType = msg.Tags["X-Request-Type"]
            local requestor = msg.Tags["X-Requestor"]
            local question = msg.Tags["X-Question"]
            local location = msg.Tags["X-Location"]

            -- Send error response back to the original requestor if it's a custom question
            if requestType == "custom-question" and requestor then
                ao.send({
                    Target = requestor,
                    Action = "weather-question-error",
                    Question = question or "Custom weather question",
                    Location = location or "Unknown location",
                    Error = "Relay request failed: " .. tostring(msg.Data or "Unknown error"),
                    Status = "error"
                })

                print("📤 Error response sent to requestor: " .. requestor)
            end

            return
        end

        -- Handle custom weather questions (from chunked data)
        if msg.Tags["X-Request-Type"] == "custom-question" and msg.Tags["X-Requestor"] then
            print("🌤️ Processing custom weather question response")

            if success and parsedData.answer then
                print("  AI Weather Assistant Response:")
                print("  Answer: " .. string.sub(parsedData.answer, 1, 100) .. "...")

                -- Send response back to the original requestor (skip if cron job)
                if msg.Tags["X-Requestor"] ~= "crontroller" then
                    ao.send({
                        Target = msg.Tags["X-Requestor"],
                        Action = "weather-question-answered",
                        Question = msg.Tags["X-Question"] or "Custom weather question",
                        Location = msg.Tags["X-Location"] or "Unknown location",
                        Answer = parsedData.answer,
                        SessionId = parsedData.session_id,
                        Status = "success"
                    })

                    print("📤 Response sent to requestor: " .. msg.Tags["X-Requestor"])
                else
                    print("🕐 Cron job: Custom weather question cache updated silently")
                end
            elseif success and parsedData.error then
                print("  AI Weather Assistant Error: " .. tostring(parsedData.error))

                -- Send error response back to the original requestor (skip if cron job)
                if msg.Tags["X-Requestor"] ~= "crontroller" then
                    ao.send({
                        Target = msg.Tags["X-Requestor"],
                        Action = "weather-question-error",
                        Question = msg.Tags["X-Question"] or "Custom weather question",
                        Location = msg.Tags["X-Location"] or "Unknown location",
                        Error = parsedData.error,
                        Status = "error"
                    })

                    print("📤 Error response sent to requestor: " .. msg.Tags["X-Requestor"])
                else
                    print("🕐 Cron job: Custom weather question error handled silently")
                end
            else
                print("  Unexpected response format: " .. json.encode(parsedData))

                -- Send generic response back to the original requestor (skip if cron job)
                if msg.Tags["X-Requestor"] and msg.Tags["X-Requestor"] ~= "crontroller" then
                    ao.send({
                        Target = msg.Tags["X-Requestor"],
                        Action = "weather-question-answered",
                        Question = msg.Tags["X-Question"] or "Custom weather question",
                        Location = msg.Tags["X-Location"] or "Unknown location",
                        Answer = "Received weather data but format was unexpected",
                        RawData = json.encode(parsedData),
                        Status = "partial"
                    })

                    print("📤 Partial response sent to requestor: " .. msg.Tags["X-Requestor"])
                else
                    print("🕐 Cron job: Custom weather question partial response handled silently")
                end
            end
            return
        end

        -- For non-custom weather requests, the shared function already handles everything
        return
    end

    -- General relay result logging and processing
    print("Relay Result:")
    print("  RequestId: " .. tostring(requestId))
    print("  Status: " .. tostring(status))
    if httpStatus then
        print("  HTTP Status: " .. tostring(httpStatus))
    end
    if httpStatusText then
        print("  HTTP Status Text: " .. tostring(httpStatusText))
    end

    -- Try to parse the data if it's JSON
    if msg.Data and msg.Data ~= "" then
        if success then
            print("  Response Data: " .. tostring(parsedData))

            -- Print additional response details if available
            if parsedData.status then
                print("  Response Status: " .. tostring(parsedData.status))
            end
            if parsedData.statusText then
                print("  Response Status Text: " .. tostring(parsedData.statusText))
            end
            if parsedData.data then
                print("  Response Data Type: " .. type(parsedData.data))
                if type(parsedData.data) == "string" then
                    print("  Response Data Length: " .. #parsedData.data .. " characters")
                    -- Print first 200 characters of response data
                    local preview = string.sub(parsedData.data, 1, 200)
                    if #parsedData.data > 200 then
                        preview = preview .. "..."
                    end
                    print("  Response Data Preview: " .. preview)
                end
            end
            if parsedData.headers then
                print("  Response Headers: " .. tostring(parsedData.headers))
            end
            if parsedData.success ~= nil then
                print("  Success: " .. tostring(parsedData.success))
            end
            if parsedData.error then
                print("  Error: " .. tostring(parsedData.error))
            end
        else
            print("  Raw Data: " .. tostring(msg.Data))
        end
    end
end

--[[
    Handler for relay response status messages.
    Only logs failures since successful responses don't need processing.
--]]
Handlers.add("Relay-Response", Handlers.utils.hasMatchingTag("Action", "Relay-Response"),
    function(msg)
        if msg.Tags.Status == "Success" then
            return
        else
            print("Relay-Response failed")
            print(msg.Tags.Status)
            print(msg.Tags.Error)
        end
    end
)

--[[
    Handler for chunked relay results from the mock relay.
    Reconstructs complete messages from multiple chunks and processes them.
--]]
Handlers.add("relay-result-chunk",
    Handlers.utils.hasMatchingTag("Action", "Relay-Result-Chunk"),
    function(msg)
        print("Received relay result chunk")

        -- Extract chunk information (handle case sensitivity)
        local chunkMessageId = msg.Tags.ChunkMessageId or msg.Tags.Chunkmessageid
        local chunkIndex = tonumber(msg.Tags.ChunkIndex or msg.Tags.Chunkindex)
        local totalChunks = tonumber(msg.Tags.TotalChunks or msg.Tags.Totalchunks)
        local requestId = msg.Tags.RequestId or msg.Tags.Requestid
        local status = msg.Tags.Status

        if not chunkMessageId or not chunkIndex or not totalChunks or not requestId then
            print("Error: Missing required chunk tags")
            return
        end

        print("Processing relay result chunk: chunk " ..
            (chunkIndex + 1) .. " of " .. totalChunks .. " (ID: " .. chunkMessageId .. ")")

        -- Initialize chunk storage for this chunk message if needed
        if not chunkedRelayResponses[chunkMessageId] then
            chunkedRelayResponses[chunkMessageId] = {
                chunks = {},
                totalChunks = totalChunks,
                requestId = requestId,
                status = status,
                metadata = {}
            }
        end

        -- Store this chunk
        chunkedRelayResponses[chunkMessageId].chunks[chunkIndex] = msg.Data

        -- Store metadata from the first chunk (HTTP status, etc.)
        if chunkIndex == 0 then
            for tagName, tagValue in pairs(msg.Tags) do
                if tagName == "HttpStatus" or tagName == "HttpStatusText" or tagName == "ForwardedBy" or
                    string.sub(tagName, 1, 2) == "X-" then
                    chunkedRelayResponses[chunkMessageId].metadata[tagName] = tagValue
                end
            end
        end

        -- Check if we have all chunks (regardless of arrival order)
        local allChunksReceived = true
        for i = 0, totalChunks - 1 do
            if not chunkedRelayResponses[chunkMessageId].chunks[i] then
                allChunksReceived = false
                break
            end
        end

        if allChunksReceived then
            print("All chunks received! Reconstructing complete message...")

            -- Reconstruct the complete message
            local completeMessage = ""
            for i = 0, totalChunks - 1 do
                local chunk = chunkedRelayResponses[chunkMessageId].chunks[i]
                completeMessage = completeMessage .. chunk
                print("  Added chunk " .. (i + 1) .. "/" .. totalChunks .. " (" .. #chunk .. " bytes)")
            end

            print("Complete message reconstructed: " .. #completeMessage .. " bytes")

            -- Create a complete message structure with all metadata and data
            local completeMsg = {
                Data = completeMessage,
                Tags = {}
            }

            -- Copy all metadata from the chunked response
            for key, value in pairs(chunkedRelayResponses[chunkMessageId].metadata) do
                completeMsg.Tags[key] = value
            end

            -- Add any additional tags that might be needed
            completeMsg.Tags.RequestId = requestId
            completeMsg.Tags.Status = status

            -- Process the complete message using the shared function
            print("🔄 Processing complete chunked message with shared function...")
            relayResultAction(completeMsg, requestId, status,
                chunkedRelayResponses[chunkMessageId].metadata.HttpStatus,
                chunkedRelayResponses[chunkMessageId].metadata.HttpStatusText)
            print("✅ Complete chunked message processed")

            -- Clean up chunked response storage
            chunkedRelayResponses[chunkMessageId] = nil
            print("Chunk storage cleaned up for: " .. chunkMessageId)
        else
            print("Waiting for more chunks: " .. (chunkIndex + 1) .. " of " .. totalChunks .. " (have " ..
                #chunkedRelayResponses[chunkMessageId].chunks .. " of " .. totalChunks .. ")")
        end
    end
)

--[[
    Handler for single relay results (non-chunked).
    Directly processes relay responses without chunking.
--]]
Handlers.add("relay-result",
    Handlers.utils.hasMatchingTag("Action", "Relay-Result"),
    function(msg)
        local requestId = msg.Tags.RequestId
        local status = msg.Tags.Status
        local httpStatus = msg.Tags.HttpStatus
        local httpStatusText = msg.Tags.HttpStatusText

        -- Call the shared relay result action function
        relayResultAction(msg, requestId, status, httpStatus, httpStatusText)
    end
)
