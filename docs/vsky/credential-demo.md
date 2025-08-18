# Credential Demo

## Add Credentials to the Contentmultimap 

The identity's contentmultimap needs credentials, including a username and password, to be able to log in.

### 1. Generate the encryption and viewing keys.

Use `z_getencryptionaddress` with the z-address from the identity, and set `fromID` and `toID` to the identity.
```bash
./verus z_getencryptionaddress '{
    "address": "z-address",
    "fromid": "identity@",
    "toid": "identity@"
}'
```

Save the `address` (encryption address) and `extendedviewingkey` for later.

### 2. Encrypt the credentials.

Use `signdata` to encrypt the credentials. The credentials should be formatted as follows.
```bash
"vrsc::data.type.object.credential":{
  "version": 1,
  "credentialkey": "",
  "credential": "",
  "scopes": ""
}
```

For the credential, the fields need to be set as follows
* **version**: Set as 1
* **credentialkey**: Use `iN6LYCurcypx7orxkFB73mWRq6Jetf23ck` for the plain login key
* **credential**: This is the username and password in a list
* **scopes**: The i-address or name of the identity **signing** the login requests in a list

For encrypting a username and password, this would look as follows.
```bash
./verus -testnet signdata '{
  "address":"iNP8ja6aDsG3dDgQcFpGwqfLhj5kPAiQF5",
  "vdxfdata": {
    "vrsc::data.type.object.credential":{
      "version": 1,
      "credentialkey": "iHh1FFVvcNb2mcBudD11umfKJXHbBbH6Sj",
      "credential": ["username_here", "password_here"],
      "scopes": ["AppID@"]
    }
  },
  "encrypttoaddress": "address_for_encryption"
}'
```

After running `signdata`, get the data descriptor in the array under the first `datadescriptor` key. This will be added to the contentmultimap later.  

Perform encryption to get the username and password descriptor.

### 3. Updating the Identity's Contentmultimap

Now you should have the `extendedviewingkey`, and a data descriptor for the credential.

Generate the `vrsc::identity.credentials` key hashed with the `extendedviewingkey` using `getvdxfid`.
```bash
./verus getvdxfid vrsc::identity.credentials '{"vdxfkey":"extendedviewingkey"}'
```

From the resulting JSON, save the `vdxfid` value under the `vdxfid` key. Now with the `vdxfid` value and the data descriptors,
use `updateidentity` with the following format to add these to the contentmultimap.

```bash
./verus updateidentity '{     
  "name": "identity@",
  "contentmultimap": {
    "vdxfid value": [
        {
          "vrsc::data.type.object.datadescriptor": data descriptor
        }
    ]
  }
}'
```

With the data descriptors, the command should look similar to the following.
```bash
./verus updateidentity '{     
  "name": "identity@",
  "contentmultimap": {
    "iGyAsYou1KCBkspTRMtFfKusvZPmwHENE3": [
        {
          "vrsc::data.type.object.datadescriptor": {
            "version": 1,
            "flags": 5,
            "objectdata": "9617d77c118427b0d5642c51a2ffbae5c288e9d91c0b23d3bdc36d9d0ee73ef73c7191bdb8b821274975f7785b718b1b19a9cb038d2476dc96d520439bb4fbb95e3e36122a9790c9c60cedbdb9e4f49acf2c5f4307931171ad266h508e336f9ee49903fe56c96aa523ea3caa20d9bda79b074c71f51b9cfed874c7d6dba07242d29a4d5b48688e673febbbee0f9f65c11b72d35ff264",
            "epk": "bf5a310cfd6e74cc8f1c2a4659232f30ea4e31a429d5d7c27080e349e9b1ec1d"
          }
        }
    ]
  }
}'
```

## Login Process Demo

1. Visit [http://localhost:19006](http://localhost:19006), the web app's URL.
2. Click the "Sign in" button.
3. With the account provider as "VeruSky", click the "Next" button. You may have to wait briefly for the "Next" button to load.
4. This should automatically open the Desktop Wallet if deeplinks are properly configured.
    - If this does not open on Linux, check [Setting up Deeplinks with the Desktop Wallet](#setting-up-deeplinks-with-the-desktop-wallet)
6. Review the login prompts and select the identity containing the credentials (`VeruSky@`).
7. Click "Done" and return back to the web app. The login should then complete after a brief moment.
8. Going into "Settings" and then "Account" will show you the identity's name at the top, above the email address.
