local json = require("json")

Whitelist = Whitelist or
    {  }

Handlers.add("relay-request",
    Handlers.utils.hasMatchingTag("Action", "Relay-Request"),
    function(msg)
        print("Received relay request from " .. msg.From)

        -- Check whitelist more gracefully
        local isWhitelisted = false
        for _, whitelistedAddress in ipairs(Whitelist) do
            if whitelistedAddress == msg.From then
                isWhitelisted = true
                break
            end
        end

        if not isWhitelisted then
            print("Relay request rejected from non-whitelisted address: " .. msg.From)
            ao.send({
                Target = msg.From,
                Data = "Relay request from non-whitelisted address: " .. msg.From,
                Tags = {
                    { name = "Action", value = "Relay-Response" },
                    { name = "Status", value = "Error" },
                    { name = "Error",  value = "Non-whitelisted address" }
                }
            })
            return
        end

        print("Whitelist check passed for address: " .. msg.From)

        print("Whitelist check passed for address: " .. msg.From)

        -- Debug: Print all received tags
        print("Received tags:")
        for tagName, tagValue in pairs(msg.Tags) do
            print("  " .. tagName .. " = " .. tostring(tagValue))
        end

        -- Validate required tags for HTTP request construction
        local requiredTags = { "Request-URL", "Method" }
        local missingTags = {}
        print("checking tags")
        for _, tagName in ipairs(requiredTags) do
            print("Checking for tag: " .. tagName)
            -- Check for both uppercase and lowercase versions
            local tagFound = msg.Tags[tagName] or msg.Tags[string.lower(tagName)] or msg.Tags[string.upper(tagName)]
            if not tagFound then
                print("Tag missing: " .. tagName)
                table.insert(missingTags, tagName)
            else
                print("Tag found: " .. tagName .. " = " .. tostring(tagFound))
            end
        end
        print("tags processed")
        print(missingTags)
        -- if #missingTags > 0 then
        --     ao.send({
        --         Target = msg.From,
        --         Data = "Missing required tags: " .. table.concat(missingTags, ", "),
        --         Tags = {
        --             { name = "Action", value = "Relay-Response" },
        --             { name = "Status", value = "Error" },
        --             { name = "Error",  value = "Missing required tags" }
        --         }
        --     })
        --     return
        -- end
        -- print("no missing tags")
        -- Extract HTTP request parameters from tags
        local url = msg.Tags["Request-URL"] or msg.Tags["Request-Url"] or msg.Tags["request-url"]
        local method = msg.Tags.Method
        local headers = msg.Tags.Headers or "{}"
        local body = msg.Tags.Body or ""
        local postData = msg.Tags["Post-Data"] or "" -- New Post-Data tag for POST requests
        local timeout = msg.Tags.Timeout or "30000"

        -- Check if body content is in the Data field instead of Body tag
        -- This handles cases where the body is too large for tags (4KB limit)
        local bodyInData = false
        if (body == "" or body == nil) and msg.Data and msg.Data ~= "" then
            print("Body tag is empty, but found content in Data field")
            bodyInData = true
            print("Large content will stay in Data field to avoid tag size limits")
        end

        -- Ensure large content doesn't go into Body tag (4KB limit)
        if body and body ~= "" and string.len(body) > 3000 then
            print("Body tag content is too large (" .. string.len(body) .. " chars), will move to Data field")
            bodyInData = true
        end

        -- Log final body content sizes for debugging
        if body and body ~= "" and not bodyInData then
            print("Final Body tag size: " .. string.len(body) .. " chars")
        end
        if bodyInData then
            print("Large content will be placed in Data field of response")
        end
        print("validating url")
        -- Validate URL format
        if not string.match(url, "^https?://") then
            ao.send({
                Target = msg.From,
                Data = "Invalid URL format. Must start with http:// or https://",
                Tags = {
                    { name = "Action", value = "Relay-Response" },
                    { name = "Status", value = "Error" },
                    { name = "Error",  value = "Invalid URL format" }
                }
            })
            return
        end
        print("validating method")
        -- Validate HTTP method
        local validMethods = { GET = true, POST = true, PUT = true, DELETE = true, PATCH = true }
        if not validMethods[string.upper(method)] then
            ao.send({
                Target = msg.From,
                Data = "Invalid HTTP method. Must be one of: GET, POST, PUT, DELETE, PATCH",
                Tags = {
                    { name = "Action", value = "Relay-Response" },
                    { name = "Status", value = "Error" },
                    { name = "Error",  value = "Invalid HTTP method" }
                }
            })
            return
        end
        print("sending success response")
        -- Collect X- prefixed tags from the original request
        local customTags = {}
        for tagName, tagValue in pairs(msg.Tags) do
            if string.sub(tagName, 1, 2) == "X-" then
                table.insert(customTags, { name = tagName, value = tostring(tagValue) })
                print("Found custom tag: " .. tagName .. " = " .. tostring(tagValue))
            end
        end

        -- Send success response with validated parameters and custom tags
        local responseTags = {
            { name = "Action",    value = "Relay-Response" },
            { name = "Status",    value = "Success" },
            { name = "Requestor", value = msg.From },
            { name = "URL",       value = url },
            { name = "Method",    value = method },
            { name = "Headers",   value = headers },
            { name = "Timeout",   value = timeout }
        }

        -- Only include Body and Post-Data tags if they're small enough
        if body and body ~= "" and not bodyInData then
            table.insert(responseTags, { name = "Body", value = body })
        end
        if postData and postData ~= "" and string.len(postData) <= 3000 then
            table.insert(responseTags, { name = "Post-Data", value = postData })
        end

        -- Add a note about where the body content came from
        if bodyInData then
            table.insert(responseTags, { name = "Body-Source", value = "Data-Field" })
            print("Added Body-Source tag indicating body came from Data field")
        elseif body and body ~= "" then
            table.insert(responseTags, { name = "Body-Source", value = "Body-Tag" })
            print("Added Body-Source tag indicating body came from Body tag")
        end

        -- Add custom tags to the response
        for _, customTag in ipairs(customTags) do
            table.insert(responseTags, customTag)
        end

        -- Determine what to put in the Data field
        local responseData
        if bodyInData then
            -- Put the large content in the Data field
            if msg.Data and msg.Data ~= "" then
                responseData = msg.Data
            else
                responseData = body
            end
            print("Putting large content in Data field of response")
        else
            -- Use placeholder text for small requests
            responseData = "Relay request validated successfully"
        end

        ao.send({
            Target = msg.From,
            Data = responseData,
            Tags = responseTags
        })
        print("function complete")
    end
)

-- Store chunked responses temporarily with dedicated tracking
local chunkedResponses = {}

-- Handler for regular axios responses (single messages or error responses)
Handlers.add("axios-response",
    Handlers.utils.hasMatchingTag("Action", "axios-response"),
    function(msg)
        print("Received axios response message")

        -- Extract the original requestor from the Requestor tag
        local requestor = msg.Tags.Requestor
        if not requestor then
            print("Error: No Requestor tag found in axios response")
            return
        end

        print("Forwarding response to requestor: " .. requestor)

        -- Collect X- prefixed custom tags from the axios response
        local customTags = {}
        for tagName, tagValue in pairs(msg.Tags) do
            if string.sub(tagName, 1, 2) == "X-" then
                table.insert(customTags, { name = tagName, value = tostring(tagValue) })
                print("Found custom tag in axios response: " .. tagName .. " = " .. tostring(tagValue))
            end
        end

        -- Check if this is an error response
        local isErrorResponse = msg.Tags.IsErrorResponse == "true"
        if isErrorResponse then
            print("Processing error response, forwarding simplified error to requestor")
            processAxiosResponse(msg.Data, requestor, msg.Tags.RequestId, customTags)
            return
        end

        -- Single message response
        print("Processing single message response")
        processAxiosResponse(msg.Data, requestor, msg.Tags.RequestId, customTags)
    end
)

-- Separate handler for chunked responses
Handlers.add("axios-response-chunk",
    Handlers.utils.hasMatchingTag("Action", "axios-response-chunk"),
    function(msg)
        print("Received axios response chunk")

        -- Debug: Print all received tags
        print("Received chunk tags:")
        for tagName, tagValue in pairs(msg.Tags) do
            print("  " .. tagName .. " = " .. tostring(tagValue))
        end

        -- Extract chunk information (handle case sensitivity)
        local chunkMessageId = msg.Tags.ChunkMessageId or msg.Tags.Chunkmessageid
        local chunkIndex = tonumber(msg.Tags.ChunkIndex or msg.Tags.Chunkindex)
        local totalChunks = tonumber(msg.Tags.TotalChunks or msg.Tags.Totalchunks)
        local requestId = msg.Tags.RequestId or msg.Tags.Requestid
        local requestor = msg.Tags.Requestor

        print("Extracted chunk info:")
        print("  ChunkMessageId: " .. tostring(chunkMessageId))
        print("  ChunkIndex: " .. tostring(chunkIndex))
        print("  TotalChunks: " .. tostring(totalChunks))
        print("  RequestId: " .. tostring(requestId))
        print("  Requestor: " .. tostring(requestor))

        if not chunkMessageId or not chunkIndex or not totalChunks or not requestId or not requestor then
            print("Error: Missing required chunk tags")
            return
        end

        print("Processing chunked response: chunk " ..
            (chunkIndex + 1) .. " of " .. totalChunks .. " (ID: " .. chunkMessageId .. ")")

        -- Initialize chunk storage for this chunk message if needed
        if not chunkedResponses[chunkMessageId] then
            chunkedResponses[chunkMessageId] = {
                chunks = {},
                totalChunks = totalChunks,
                requestor = requestor,
                requestId = requestId
            }
        end

        -- Store this chunk
        chunkedResponses[chunkMessageId].chunks[chunkIndex] = msg.Data

        -- Check if this is the last chunk (handle case sensitivity)
        local isLastChunk = (msg.Tags.IsLastChunk == "true") or (msg.Tags.Islastchunk == "true")

        if isLastChunk then
            print("Last chunk received, all chunks verified. Forwarding chunks to requestor")

            -- Collect custom tags from the chunked response (they should be in all chunks)
            local customTags = {}
            for tagName, tagValue in pairs(msg.Tags) do
                if string.sub(tagName, 1, 2) == "X-" then
                    table.insert(customTags, { name = tagName, value = tostring(tagValue) })
                    print("Found custom tag in chunked response: " .. tagName .. " = " .. tostring(tagValue))
                end
            end

            -- Forward all chunks to the requestor
            forwardChunksToRequestor(chunkedResponses[chunkMessageId], requestor, requestId, customTags)

            -- Clean up chunked response storage
            chunkedResponses[chunkMessageId] = nil
        else
            print("Waiting for more chunks: " .. (chunkIndex + 1) .. " of " .. totalChunks)
        end
    end
)

-- Helper function to process the axios response
function processAxiosResponse(responseData, requestor, requestId, customTags)
    if not responseData then
        print("Error: No Data field found in axios response")
        return
    end

    -- Try to parse the JSON response
    local success, parsedResponse = pcall(json.decode, responseData)
    if not success then
        print("Error: Failed to parse response JSON")
        return
    end

    -- Check if this is an error response that should be simplified
    if parsedResponse.isErrorResponse or not parsedResponse.success then
        print("Sending simplified error response to requestor")
        ao.send({
            Target = requestor,
            Data = "Relay request failed",
            Tags = {
                { name = "Action",    value = "Relay-Result" },
                { name = "RequestId", value = requestId or "unknown" },
                { name = "Status",    value = "Error" },
                { name = "Error",     value = parsedResponse.error or "Request failed" },
                { name = "ErrorCode", value = tostring(parsedResponse.code or "unknown") }
            }
        })
        print("Error response forwarded to requestor successfully")
        return
    end

    -- For success responses, forward the entire response in Data field
    -- The response is already optimized and chunked if necessary by the monitor
    print("Forwarding response to requestor")

    local responseTags = {
        { name = "Action",         value = "Relay-Result" },
        { name = "RequestId",      value = requestId or "unknown" },
        { name = "Status",         value = "Success" },
        { name = "HttpStatus",     value = tostring(parsedResponse.status) },
        { name = "HttpStatusText", value = parsedResponse.statusText or "" }
    }

    -- Add headers if available
    if parsedResponse.headers then
        for headerName, headerValue in pairs(parsedResponse.headers) do
            table.insert(responseTags, { name = "Header-" .. headerName, value = tostring(headerValue) })
        end
    end

    -- Add custom tags to the forwarded response
    if customTags then
        for _, customTag in ipairs(customTags) do
            table.insert(responseTags, customTag)
            print("Adding custom tag to forwarded response: " .. customTag.name .. " = " .. customTag.value)
        end
    end

    -- Send the entire response in Data field (already optimized by monitor)
    print("Sending response to requestor: " .. requestor)
    print("Response data size: " .. #responseData .. " bytes")
    print("Response tags count: " .. #responseTags)

    local success, result = pcall(function()
        ao.send({
            Target = requestor,
            Data = responseData, -- Use the original responseData, not parsedResponse.data
            Tags = responseTags
        })
    end)

    if success then
        print("Response forwarded to requestor successfully")
    else
        print("Error forwarding response to requestor: " .. tostring(result))
    end
end

-- Function to forward chunked responses to the requestor
function forwardChunksToRequestor(chunkData, requestor, requestId, customTags)
    print("Forwarding " .. chunkData.totalChunks .. " chunks to requestor: " .. requestor)

    -- Generate a unique chunk message ID for the forwarded chunks
    local forwardedChunkId = "relay_forwarded_" .. requestId .. "_" .. os.time()

    for i = 0, chunkData.totalChunks - 1 do
        local chunk = chunkData.chunks[i]
        if chunk then
            local isLastChunk = (i == chunkData.totalChunks - 1)

            -- Create tags for the forwarded chunk
            local chunkTags = {
                { name = "Action",         value = "Relay-Result-Chunk" },
                { name = "RequestId",      value = requestId or "unknown" },
                { name = "Status",         value = "Success" },
                { name = "ChunkMessageId", value = forwardedChunkId },
                { name = "ChunkIndex",     value = tostring(i) },
                { name = "TotalChunks",    value = tostring(chunkData.totalChunks) },
                { name = "IsLastChunk",    value = isLastChunk and "true" or "false" },
                { name = "ForwardedBy",    value = "MockRelay" }
            }

            -- Add metadata to first chunk only
            if i == 0 then
                -- Extract basic response info from the first chunk (if it's JSON)
                local success, parsedChunk = pcall(json.decode, chunk)
                if success and parsedChunk.status then
                    table.insert(chunkTags, { name = "HttpStatus", value = tostring(parsedChunk.status) })
                    if parsedChunk.statusText then
                        table.insert(chunkTags, { name = "HttpStatusText", value = parsedChunk.statusText })
                    end
                end
            end

            -- Add custom tags to each chunk
            if customTags then
                for _, customTag in ipairs(customTags) do
                    table.insert(chunkTags, customTag)
                end
            end

            print("Forwarding chunk " .. (i + 1) .. "/" .. chunkData.totalChunks .. " to requestor")

            ao.send({
                Target = requestor,
                Data = chunk,
                Tags = chunkTags
            })
        else
            print("Warning: Missing chunk " .. i .. " - cannot forward")
        end
    end

    print("All chunks forwarded to requestor successfully")
end

-- Handler for managing whitelist (owner only)
Handlers.add("whitelist-manage",
    Handlers.utils.hasMatchingTag("Action", "Whitelist-Manage"),
    function(msg)
        print("Received whitelist management request from " .. msg.From)

        -- Only the owner can manage the whitelist
        if msg.From ~= Owner then
            print("Whitelist management rejected: not owner")
            ao.send({
                Target = msg.From,
                Data = "Whitelist management rejected: not owner",
                Tags = {
                    { name = "Action", value = "Whitelist-Response" },
                    { name = "Status", value = "Error" },
                    { name = "Error",  value = "Not authorized" }
                }
            })
            return
        end

        -- Extract operation and address from tags
        local operation = msg.Tags.Operation
        local address = msg.Tags.Address

        if not operation or not address then
            print("Whitelist management failed: missing Operation or Address tag")
            ao.send({
                Target = msg.From,
                Data = "Whitelist management failed: missing Operation or Address tag",
                Tags = {
                    { name = "Action", value = "Whitelist-Response" },
                    { name = "Status", value = "Error" },
                    { name = "Error",  value = "Missing Operation or Address tag" }
                }
            })
            return
        end

        print("Processing whitelist operation: " .. operation .. " for address: " .. address)

        if operation == "add" then
            -- Check if address is already in whitelist
            local alreadyExists = false
            for _, whitelistedAddress in ipairs(Whitelist) do
                if whitelistedAddress == address then
                    alreadyExists = true
                    break
                end
            end

            if alreadyExists then
                print("Address " .. address .. " is already in whitelist")
                ao.send({
                    Target = msg.From,
                    Data = "Address " .. address .. " is already in whitelist",
                    Tags = {
                        { name = "Action",  value = "Whitelist-Response" },
                        { name = "Status",  value = "Error" },
                        { name = "Error",   value = "Address already in whitelist" },
                        { name = "Address", value = address }
                    }
                })
                return
            end

            -- Add address to whitelist
            table.insert(Whitelist, address)
            print("Added " .. address .. " to whitelist. New whitelist size: " .. #Whitelist)

            ao.send({
                Target = msg.From,
                Data = "Address " .. address .. " added to whitelist successfully",
                Tags = {
                    { name = "Action",        value = "Whitelist-Response" },
                    { name = "Status",        value = "Success" },
                    { name = "Operation",     value = "add" },
                    { name = "Address",       value = address },
                    { name = "WhitelistSize", value = tostring(#Whitelist) }
                }
            })
        elseif operation == "remove" then
            -- Find and remove address from whitelist
            local found = false
            for i, whitelistedAddress in ipairs(Whitelist) do
                if whitelistedAddress == address then
                    table.remove(Whitelist, i)
                    found = true
                    break
                end
            end

            if not found then
                print("Address " .. address .. " not found in whitelist")
                ao.send({
                    Target = msg.From,
                    Data = "Address " .. address .. " not found in whitelist",
                    Tags = {
                        { name = "Action",  value = "Whitelist-Response" },
                        { name = "Status",  value = "Error" },
                        { name = "Error",   value = "Address not found in whitelist" },
                        { name = "Address", value = address }
                    }
                })
                return
            end

            print("Removed " .. address .. " from whitelist. New whitelist size: " .. #Whitelist)

            ao.send({
                Target = msg.From,
                Data = "Address " .. address .. " removed from whitelist successfully",
                Tags = {
                    { name = "Action",        value = "Whitelist-Response" },
                    { name = "Status",        value = "Success" },
                    { name = "Operation",     value = "remove" },
                    { name = "Address",       value = address },
                    { name = "WhitelistSize", value = tostring(#Whitelist) }
                }
            })
        elseif operation == "list" then
            -- List all whitelisted addresses
            local whitelistStr = table.concat(Whitelist, ", ")
            print("Listing whitelist: " .. whitelistStr)

            ao.send({
                Target = msg.From,
                Data = "Current whitelist: " .. whitelistStr,
                Tags = {
                    { name = "Action",        value = "Whitelist-Response" },
                    { name = "Status",        value = "Success" },
                    { name = "Operation",     value = "list" },
                    { name = "WhitelistSize", value = tostring(#Whitelist) },
                    { name = "Whitelist",     value = whitelistStr }
                }
            })
        else
            print("Invalid operation: " .. operation)
            ao.send({
                Target = msg.From,
                Data = "Invalid operation: " .. operation .. ". Supported operations: add, remove, list",
                Tags = {
                    { name = "Action",              value = "Whitelist-Response" },
                    { name = "Status",              value = "Error" },
                    { name = "Error",               value = "Invalid operation" },
                    { name = "SupportedOperations", value = "add, remove, list" }
                }
            })
        end
    end
)

print("Mock relay code loaded successfully")
