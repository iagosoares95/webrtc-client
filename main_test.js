const uri = "iago_ws@52.173.36.237";
  const options = {
    authenticationUsername: "iago_ws",
    password: "teste",
    uri: uri,
    
  };

  const ua = new UA(options);

  ua.on("registered", (response: any) => {
    console.log("Registered");
  });
  ua.on("registrationFailed", () => {
    console.log("Failed to register");
  });
  ua.on("unregistered", (response, cause) => {
    console.log("Unregistered");
  });

  ua.register();

  if (ua.isRegistered()) {
    // Currently registered
  }

  ua.unregister();
