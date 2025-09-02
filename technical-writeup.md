# GUS Agent Technical Write Up


## Overview

GUS, The first Personal AO Assistant, is designed to seamlessly mix web3 with daily lives. Performing many operations traditionally handled by Personal Digital Assistants, or AI assistants. These include keeping a schedule calendar, gathering local weather data, tracking token portfolios and prices, giving notifications to a user, and much more.

There were some techincal issues related to AO infrastructure and goldsky/gql outages that limited feature implementation for this hackathon, but the bones are present and ready to be built on. With very little additional work, it would not be difficult to enable GUS agents to talk to each other as well. Imagine being able to avoid awkward "what's a good time for you?" back and forths when trying to set a good time for a business meeting when GUS can talk to each other's agents and schedule the meeting for you automatically!  GUS is the digital assistant that the tech industry has been striving for since the 90s.

It is worth noting that GUS is the first AO process that has ever successfully sent a web2 email.

## Infrastructure Replacements

There are 3 main pieces of HB infrastucture that were not functional when this hackathon began that required custom recreations on legacynet. Each is a marvel of engineering and warrants a hackathon entry on its own merit, but the combination of all of them enable GUS to function while Hyperbeam development continues:

### Relay/Resolver Device

The ability to send http requests from inside AO was an absolutely essential feature for this hackathon. While there are a number of useful things that can be done without ever leaving AO, true utility requires the ability to communicate with the outside world. Even trading bots would be incredibly limited in their practicality if they could ONLY see pricing data from AO dex's. Since the Relay device was not functional until approximately halfway through the hackathon, I built a custom solution for GUS that can be easily adapted to provide http access to any legacynet process for any reason. It functions similarly to how Orbit used to (I believe), but with additional features that allow complete, fully customized axios requests, for all methods: GET, POST, PUT, DELETE.

This mock-relay consists of an AO process that accepts and validates relay requests, and a simple, lightweight node server that checks gql for messages validated by the relay process, constructs and sends the axios request, and then sends the response back to the relay process to be forwarded back to the original requestor.

Most impressively, it even natively supports chunking for large responses, so a process is not limited to the 10mb Data Item size limit of AO messages. It can ingest entire websites or 365 days of coingeko pricing data with ease.

The Relay Monitor server is incredibly light-weight and can be run by anyone on almost anything. I see it as a sidecar for the over 600 people who are currently running ARIO gateways. It can run indefinitely with negligible compute requirements and almost no disk requirements. Each can be adapted to facilitate the gateway operator's own GUS agent, and / or offered as a service for other people.

## Private Key Management

Hyperbeam is supposed to have a device that allows abstracting out private keys so that private information can be sent through Hyperbeam without exposing it publicly. This is a Hyperbeam specific feature and lacks substantial documentation at this time. If this feature is fully functional, it would not be accessible to legacynet processes.

As a solution, a feature was built into the mock relay that allows operators to use pre-configured strings to be found and replaced during an axios call. Inside AO, Agents and the relay process see "youWillNeverGetThis", but when the relay monitor server processes a request containing that string, it is able to replace that with an api key in order to make a successful private api call without exposing the data. It even processes responses to reverse the replacement so that response data doesn't accidentally expose those keys.

This feature facilitates things like sending web2 notification emails from inside AO using a private service (Brevo in this case) without exposing any private information.

## The Crontroller

The Crontroller is everything that Cron SHOULD have been from the start. By abstracting away the actual cron functionality, the Crontroller can perform any number of different actions on different intervals. The GUS agent can register with the Crontroller to have its current weather cache updated every hour, while updating token prices and portfolio balances only every 6 hours, and sending a daily summary email once daily. It breaks processes away from the limited "Cron" Action inherent in the native cron functionality because tick messages can be sent with any Action and any number of additional tags. It also allows creating, updating, or deleting cron jobs whenever it makes sense to do so, instead of needing to specify cron intervals only when creating a process and then live with cron either on or off.


## GUS

GUS, in his current infancy, is arguably already the most practical process on AO. He is able to gather information and perform actions autonomously that a non-web3-native would be able to pick up and integrate into their daily lives without a second thought. His most impressive feature is the ability to send daily summary emails, via web2 email services, directly to users. This lets them receive generally useful information that people usually look for, like their local weather, while subtly pushing them towards web3 adoption by showing AO and PI distribution amounts and portfolio balances/prices. The future of GUS likely involves a mobile app that will allow this information to be sent directly via push notification to maximize native integration into people's daily lives. APUS integration was not practical due to existing on legacynet, but when the Hyperbeam infrastructure catches up to GUS's requirements he will become a full fledged AI assistant that exists autonomously on AO and will run forever.
