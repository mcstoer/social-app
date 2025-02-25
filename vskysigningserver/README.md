# Verisky Signing Server

This is for signing login requests.

## Running the Server

- `yarn dev` 

### Environment Variables

- `BASE_URL`: URL for login responses to redirect to.
- `BASE_WEBHOOK_URL`: URL for login responses to POST to.

- `IADDRESS`: i-address that is signing the responses.
- `WIF`: private key associated with the i-address.
- `DEFAULT_CHAIN`: chain that the signing is done on.
- `DEFAULT_URL`: URL for the RPC server for the chain.

- `PORT`: port that this server runs on.