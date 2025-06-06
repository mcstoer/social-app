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
  "credentialKey": "",
  "credential": "",
  "scopes": ""
}
```

For the credential, the fields need to be set as follows
* **version**: Set as 1
* **credentialKey**: Use `iN6LYCurcypx7orxkFB73mWRq6Jetf23ck` for the username key and `iBnntHeXcHacGFSGY836MN1pL4U2KJhXWm` for the password key
* **credential**: This is either the username or password
* **scopes**: The i-address or name of the identity **signing** the login requests

For encrypting a username, this would look as follows.
```bash
./verus signdata '{
  "address":"identity@",
  "vdxfdata": {
    "vrsc::data.type.object.credential":{
      "version": 1,
      "credentialKey": "iN6LYCurcypx7orxkFB73mWRq6Jetf23ck",
      "credential":"mytestusername",
      "scopes": "TheSigningID@"
    }
  },
  "encrypttoaddress": "address (encryption address)" 
}'
```

For encrypting a password, this would look as follows.
```bash
./verus signdata '{
  "address":"identity@",
  "vdxfdata": {
    "vrsc::data.type.object.credential":{
      "version": 1,
      "credentialKey": "iBnntHeXcHacGFSGY836MN1pL4U2KJhXWm",
      "credential":"mytestpassword",
      "scopes": "TheSigningID@"
    }
  },
  "encrypttoaddress": "address (encryption address)" 
}'
```

After running `signdata`, get the data descriptor in the array under the first `datadescriptor` key. This will be added to the contentmultimap later.  

Perform encryption to get both the username and password data descriptors.

### 3. Updating the Identity's Contentmultimap

Now you should have the `extendedviewingkey`, and data descriptors for both the **username** and **password**. 

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
          "vrsc::data.type.object.datadescriptor": username data descriptor
        },
        {
          "vrsc::data.type.object.datadescriptor": password data descriptor
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
        },
        {
          "vrsc::data.type.object.datadescriptor": {
            "version": 1,
            "flags": 5,
            "objectdata": "dec9a90e5f1f0fa3276899b05fba3b038a0d6454daa423183a959cfa4b5fe32dfaf7d2bf76b832c4e20d6f2f168414474440d1f5f7d98382a2cd052639cdafe006d33f7e15c52287f9d12d07d5b41d1bf3028f32cd2d76f8321c6bb324sa3054248dc295fca9a4a90bdf673d7b38638f2cf275399a4250e790db4870f42b9630d7f1a508cd5c691a0d0db9bec7222528e6809b8972d9",
            "epk": "a54048e77af95d33f4b0a605e9cfe52be9168812c69370defdea82b834dd7ad5"
          }
        }
    ]
  }
}'
```

## Setting up with the Desktop Wallet

For deeplinks to work on Linux, the operating system needs to be able to associate the desktop wallet with the deeplinks. The guide at in the description of a pull request at [https://github.com/VerusCoin/Verus-Desktop/pull/259](https://github.com/VerusCoin/Verus-Desktop/pull/259). It explains methods to get this association set up. I personally use the first method, [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher), that does it on running the appimage.


## Setting up VeruSky

Get the VeruSky code from [https://github.com/mcstoer/social-app/tree/verusky](https://github.com/mcstoer/social-app/tree/verusky) and checkout the `verusky` branch.

### Setting up the Environment

The project requires `nvm`, `Node.js` and `yarn`. Use `nvm install 20` and `nvm use 20` to get Node.js 20. Afterwards, use `npm install --global yarn` to install yarn. 

My current setup uses `nvm` 0.40.1, `Node.js` 20.19.0 and `yarn` 1.22.22.

### Running the VeruSky Web App

This follows in instructions in repository, which can be found at [https://github.com/mcstoer/social-app/blob/verusky/docs/build.md](https://github.com/mcstoer/social-app/blob/verusky/docs/build.md).

To run the main social media app, do the following.
1. `yarn`
2. `yarn web`

To run the login server, open another terminal window, enter the `vskylogin` directory, and do the following.
1. `yarn`
2. `yarn web`

To run the signing server, open another terminal window, enter the `vskysigningserver` directory, and do the following.
1. Copy the `.env.example` file to `.env`.
2. Find an identity you want to use to sign the requests. This should be the same identity used for **scopes** in the credentials from above.
3. Get the i-address and associated WIF for that identity.
4. Set `IADDRESS` and `WIF` variables to the matching values for the identity.
5. `yarn`
6. `yarn web`

## Login Process Demo

1. Visit [http://localhost:19006](http://localhost:19006), the web app's URL.
2. Click "Sign in".
3. With the account provider as "VeruSky", click "Next".
4. This should pop up the verus.id login screen if the desktop wallet is properly associated with the deeplink.
5. Review the login prompts and make sure to select the identity that has the credentials in it.
6. Click "Done" and return back to the web app. The login should then complete.
7. Going into "Settings" and then "Account" should show you the identity's name at the top.
