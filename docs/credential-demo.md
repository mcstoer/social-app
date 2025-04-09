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

## Setting up Deeplinks with the Desktop Wallet

### Windows

Deeplinks should work out of the box when you install the Desktop Wallet on Windows.

### Linux

For deeplinks to work on Linux, the operating system needs to be able to associate the desktop wallet with the deeplinks. The guide at in the description of a pull request at [https://github.com/VerusCoin/Verus-Desktop/pull/259](https://github.com/VerusCoin/Verus-Desktop/pull/259). It explains methods to get this association set up. I personally use the first method, [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher), that does it on running the appimage.

## Setting up VeruSky

### Setting up the Environment

The project requires:
- Node.js 20 [https://nodejs.org/en/blog/release/v20.9.0](https://nodejs.org/en/blog/release/v20.9.0)
- yarn (install after Node.js  with `npm install --global yarn`
- [GitHub CLI](https://cli.github.com/) or [Git for Windows](https://gitforwindows.org/)

### Getting the Code

Get the VeruSky code from [https://github.com/mcstoer/social-app/tree/verusky-demo](https://github.com/mcstoer/social-app/tree/verusky-demo) and checkout the `verusky-demo` branch.

For GitHub CLI (`gh`), open a terminal and run
```
gh auth login
gh repo clone https://github.com/mcstoer/social-app.git  -- --branch verusky-demo
cd social-app
```

For Git for Windows (`git`), open a terminal and run
```
git clone https://github.com/mcstoer/social-app.git --branch verusky-demo
cd social-app
```

### Running the VeruSky Web App

You will need three terminals in total, one for each local server.

#### Terminal 1
In the `social-app` directory, run the main social media app
```bash
yarn
yarn web
```

#### Terminal 2
In `social-app/vskylogin` directory, run the login server
```bash
yarn
yarn web
```

#### Terminal 3
In `social-app/vskysigningserver` directory, and do either of the following to setup the `.env` file.

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
4. Set `IADDRESS` and `WIF` variables to the matching values for the identity.
   
</details>

After creating the `.env` file, then run the signing server.
```bash
yarn
yarn web
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
