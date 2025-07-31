# VeruSky Signing Server

This is for signing login requests.

## Running the Server

- `yarn dev` 

### Environment Variables

There are default values for all but the `EXPO_PUBLIC_IADDRESS` and `WIF`.

- `BASE_URL`: URL for login responses to redirect to.
- `BASE_WEBHOOK_URL`: URL for login responses to POST to.

- `EXPO_PUBLIC_IADDRESS`: i-address that is signing the responses.
- `WIF`: private key associated with the i-address.
- `DEFAULT_CHAIN`: chain that the signing is done on.
- `DEFAULT_URL`: URL for the RPC server for the chain.

- `PORT` (optional): port that this server runs on.

### Setup Guide

<details open>
<summary>If you have the contents for an <code>.env</code> file for the signing server:</summary>

1. Create a `.env` file.
2. Copy the contents into the file.

</details>

<details>
<summary>If you do not have the contents:</summary>
    
1. Copy the `.env.example` file to `.env`.
2. Find an identity you want to use to sign the requests. This should be the same identity used for **scopes** in the credentials from above.
3. Get the i-address and associated WIF for that identity.
4. Set `EXPO_PUBLIC_IADDRESS` and `WIF` variables to the matching values for the identity.
   
</details>