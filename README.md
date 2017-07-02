# blink-components
web service that lists the components used by the Blink team

## Setup

Firebase functions does not yet support Node 8. You may need to switch to Node 6
to make sure local dev is the same as what's on the server:

```
brew switch node 6.9.1
```

Get a personal OAuth token from Github that has access to `repo:public`. Paste
that guy in a file named `.github_oauth_token`, and run:

    yarn setconfig

### Installation & Setup

You'll need the [Firebase CLI tools](https://firebase.google.com/docs/cli/).

Then install and set the project:

    yarn
    firebase use blinkcomponents-b48b5

Lastly, run:

    firebase functions:config:get > .runtimeconfig.json

to generate local env variables needed by the dev server.

### Dev

This project uses Node 8 features, so it needs to be built using Babel:

    yarn build

 This will create `./functions-dist`. FB functions will serve the functions from that directory.

Serve:

    yarn start

Deploy:

    yarn deploy

That's it!
