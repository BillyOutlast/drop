# Downpour CLI spec

`downpour [command] --opts`

## Commands:

- new <path/s3 name> <public endpoint> - creates/initalizes a depot at the endpoint. Creates manifest.json and speedtest
- connect <s3 endpoint> <key> <secret> [name] - connects to an s3 endpoint and saves the endpoint to some sort of credentials file. Name is either as provided or the hostname of the endpoint
- upload <game id> <localpath> <path/s3 name> - uploads game as described before. Should fail if depot isn't initialized with new from above
- copy <game id> <version id> <src path/s3 name> <dest path/s3 name> - copies between two depots
- mark [exists/absent] <game id> <version id> <path/s3 name> - modifies depot's manifest.json to show content exists or is absent without copying (for third party copies)
- rename <public endpoint> <new public endpoint> - renames an endpoint [NEEDS API ROUTES - can't do yet]
- delete <public endpoint> - delete an endpoint [NEEDS API ROUTES - can't do yet]
