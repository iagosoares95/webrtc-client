var userAgents = [];
var sessions = [];

var regUserAgent = {
    userAgent: null,
    inviteContext: null
};
var ctcUserAgent = {
    userAgent: null,
    inviteContext: null
};

var logger;

function applog() {
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == 'object') {
            logger.innerHTML += ((JSON && JSON.stringify) ? JSON.stringify(arguments[i], undefined, 2) : arguments[i]) + ' ';
        } else {
            logger.innerHTML += arguments[i] + ' ';
        }
    }
    logger.innerHTML += "</br>";
}

function onInvite(invitation) {
    applog("ON INVITE");
    regUserAgent.invitation = invitation;
};


var setupSession = function(session) {
    //https://sipjs.com/api/0.15.0/session/#events

    //HACK, remove and set this elsewhere
    session.on('progress', function(response) {
        applog("Received session progress:", response.statusCode);
    });

    session.on('accepted', function(data) {
        applog("<b>Session accepted</b>");
    });

    //called when a response 300-699 is received
    session.on('rejected', function(response, cause) {
        applog("Session rejected: " + response.statusCode + "</b>");
        if (response.statusCode == 301 || response.statusCode == 302) {
            //TODO: check if Contact header is really there
            uri = response.headers.Contact[0].parsed.uri;
            window.v_uri = uri;

            window.v_resp = response;


            var ua_opt = {
                transportOptions: {
                    wsServers: ['ws://' + uri.host + ':' + uri.port],
                    traceSip: true,
                },
                uri: txtURI.value,
            }

            session.logger.log("creating new UA for: ", ua_opt.transportOptions.wsServers);
            var new_ua = new SIP.UA(ua_opt);
            userAgents.push(new_ua);

            new_ua.logger.log(`creating invite to: {esponse.headers.Contact[0].parsed.uri}`);
            var newSession = new_ua.invite(response.headers.Contact[0].parsed.uri, {
                sessionDescriptionHandlerOptions: {
                    constraints: {
                        audio: true,
                        video: false
                    }
                }
            });
            setupSession(newSession);
        }
    });

    session.on('failed', function(response, cause) {
        applog("Session failed", response.statusCode, cause);
    });

    session.on('terminated', function(response, cause) {
        applog("Session terminated", response.statusCode, cause);
    });

    session.on('cancel', function() {
        applog("<b>Session cancelled</b>");
    });

    session.on('reinvite', function(a_session) {
        applog("Received a reinvite", a_session);
    });

    session.on('referRequested', function(context) {
        applog("Received a refer", context);
    });

    session.on('replaced', function(newSession) {
        applog("Session was replaced", newSession);
    });

    session.on('dtmf', function(request, dtmf) {
        applog("DTMF digit received: ", dtmf);
    });

    session.on('SessionDescriptionHandler-created', function() {
        applog("Session description handler created");
    });

    session.on('directionChanged', function() {
        applog("Media direction changed: ", session.sessionDescriptionHandler.direction);
    });

    session.on('trackAdded', function() {
        applog("Track added to session");
    });

    session.on('bye', function(request) {
        applog("<b>Session bye</b>", request);
    });
}

var setupRegisterSession = function(session) {
    session.once('registered', function() {
        applog("Register successfull");
        uaStatus.innerHTML = "Registered";
    });

    session.once('unregistered', function(cause) {
        applog("User unregistered: " + (cause ? cause.statusCode : ""));
        uaStatus.innerHTML = "Unregistered";
    });

    session.on('invite', function(context) {
        applog("<b>INVITE received</b>");
        regUserAgent.inviteContext = context;
    });
}

var _configHandle = function(save) {
    if (!localStorage)
        return;

    var load_func = function(elem, str) {
        var val;
        if (val = localStorage.getItem(str))
            elem.value = val;
    }
    var save_func = function(elem, str) {
        localStorage.setItem(str, elem.value);
    }

    var func = save == true ? save_func : load_func;

    func(txtWebSocket, 'txtWebSocketSave');
    func(txtURI, 'txtURISave');
    func(txtAuthorizationUser, 'txtAuthorizationUserSave');
    func(txtDisplayName, 'txtDisplayNameSave');
    func(txtPassword, 'txtPasswordSave');
    //applog(JSON.stringify(localStorage, false , 4));
}

var loadConfig = function() {
    _configHandle(false);
}

var saveConfig = function() {
    _configHandle(true);
}

var uaStatus; // declara a variável sem nenhum valor atribuído
document.addEventListener("DOMContentLoaded", function() {
    uaStatus = document.getElementById("ua-status");
});

var loadFields = function() {
    if (!localStorage)
        return;

    document.getElementById("txtWebSocket").value = localStorage.getItem("txtWebSocketSave");
    document.getElementById("txtURI").value = localStorage.getItem("txtURISave");
    document.getElementById("txtAuthorizationUser").value = localStorage.getItem("txtAuthorizationUserSave");
    document.getElementById("txtDisplayName").value = localStorage.getItem("txtDisplayNameSave");
    document.getElementById("txtPassword").value = localStorage.getItem("txtPasswordSave");
}

window.onload = function() {

    logger = document.getElementById('log');
    loadFields();
    loadConfig();

    var ua = {
        transportOptions: {
            //wsServers: [ txtWebSocketSave.value ],
            traceSip: true,
        },
        uri: txtURI.value,
        authorizationUser: txtAuthorizationUser.value,
        contactName: txtAuthorizationUser.value,
        displayName: txtDisplayName.value,
        password: txtPassword.value,
        level: 'debug',
        userAgentString: 'sipjs-X',
    };

    ctcUserAgent.userAgent = new SIP.UA(ua);

    /**
     * Register handlers
     */
    function isRegisterActive() {
        if (regUserAgent.userAgent == null || !regUserAgent.userAgent.isRegistered()) {
            applog("<b>User agent is not registered</b>");
            return false;
        }
        return true;
    }

    var regButton = document.getElementById('register');
    regButton.addEventListener('click', function() {
        ua = {
            transportOptions: {
                wsServers: [txtWebSocket.value],
                traceSip: true,
            },
            uri: txtURI.value,
            authorizationUser: txtAuthorizationUser.value,
            contactName: txtAuthorizationUser.value,
            displayName: txtDisplayName.value,
            password: txtPassword.value,
            level: 'debug',
            userAgentString: 'sipjs-X',
        };
        var registerUA = new SIP.UA(ua);
        registerUA.register();
        setupRegisterSession(registerUA);

        var userContact = registerUA.contact.toString();
        userContact = userContact.substr(1, userContact.length - 2);
        applog("<b>Register sent for user: " + userContact + "</b>");

        regUserAgent.userAgent = registerUA;
        saveConfig();
    });

    var unregButton = document.getElementById('unregister');
    unregButton.addEventListener('click', function() {

        if (!isRegisterActive()) {
            return;
        }

        var userContact = regUserAgent.userAgent.contact.toString();
        userContact = userContact.substr(1, userContact.length - 2);
        applog("<b>Unregistering user: " + userContact + "</b>");
        regUserAgent.userAgent.unregister();
    });

    var checkRegButton = document.getElementById("checkRegister");
    checkRegButton.addEventListener("click", function() {

        if (regUserAgent.userAgent.isRegistered())
            alert("User is registered!");
        else
            alert("User is unregistered");
    }, false);


    /**
     * Incoming call handlers, registered session only
     */
    var startButtonic = document.getElementById('startCallic');
    startButtonic.addEventListener("click", function() {
        if (!regUserAgent.inviteContext) {
            applog("<b>No incoming call received.</b>");
            return;
        }
        applog("<b>Accepting incoming call</b>");

        regUserAgent.inviteContext.accept();
    }, false);

    var cancelButtonic = document.getElementById('cancelCallic');
    cancelButtonic.addEventListener("click", function() {
        if (!regUserAgent.inviteContext) {
            applog("<b>No incoming call received.</b>");
            return;
        }

        applog("<b>Rejecting incoming call</b>");
        regUserAgent.inviteContext.reject();
    }, false);

    var endButtonic = document.getElementById('dropCallic');
    endButtonic.addEventListener("click", function() {
        if (!regUserAgent.inviteContext) {
            applog("<b>No incoming call received.</b>");
            return;
        }

        applog("<b>Dropping incoming call</b>");
        regUserAgent.inviteContext.terminate();
    }, false);


    /**
     * Outgoing call handlers, registered session only
     */
    var startButtonoc = document.getElementById("startCalloc");
    startButtonoc.addEventListener("click", function() {
        if (!isRegisterActive()) {
            return;
        }

        var inviteContext = regUserAgent.userAgent.invite(txtTargetoc.value, {
            sessionDescriptionHandlerOptions: {
                constraints: {
                    audio: true,
                    video: false
                }
            }
        });

        var toAddr = inviteContext.request.to.toString();
        toAddr = toAddr.substr(1, toAddr.length - 2);
        applog("<b>Sending INVITE to: " + toAddr + "</b>");

        setupSession(inviteContext);
        regUserAgent.inviteContext = inviteContext;
    }, false);

    var cancelButtonoc = document.getElementById("cancelCalloc");
    cancelButtonoc.addEventListener("click", function() {
        if (!isRegisterActive()) {
            return;
        }
        if (!regUserAgent.inviteContext) {
            applog("<b>No INVITE context found</b>");
            return;
        }

        regUserAgent.inviteContext.terminate();
    }, false);


    var endButtonoc = document.getElementById('dropCalloc');
    endButtonoc.addEventListener("click", function() {
        if (!isRegisterActive()) {
            return;
        }
        if (!regUserAgent.inviteContext) {
            applog("<b>No INVITE context found</b>");
            return;
        }

        regUserAgent.inviteContext.bye();
    }, false);


    /**
     * Click to call handlers, no register is used, so only outgoing calls
     *  are possible
     */
    var startButtonctc = document.getElementById("startCallctc");
    startButtonctc.addEventListener("click", function() {
        var inviteContext = ctcUserAgent.userAgent.invite(txtTargetctc.value, {
            sessionDescriptionHandlerOptions: {
                constraints: {
                    audio: true,
                    video: false
                }
            }
        });

        var toAddr = inviteContext.request.to.toString();
        toAddr = toAddr.substr(1, toAddr.length - 2);
        applog("<b>Sending INVITE to: " + toAddr + "</b>");

        setupSession(inviteContext);
        ctcUserAgent.inviteContext = inviteContext;
    }, false);

    var endButtonctc = document.getElementById('endCallctc');
    endButtonctc.addEventListener("click", function() {
        if (!ctcUserAgent.inviteContext) {
            return;
        }
        ctcUserAgent.inviteContext.terminate();
        ctcUserAgent.inviteContext = null;
    }, false);

    // Function to clear the logs screen
    var clearLogsButton = document.getElementById("clearLogs");
    clearLogsButton.addEventListener("click", function() {
        logger.innerHTML = "";
    })
}