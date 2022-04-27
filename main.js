var userAgents = [];
var sessions = [];

var setupSession = function(session) {
    //https://sipjs.com/api/0.15.0/session/#events

    //HACK, remove and set this elsewhere
    window.session = session;
    sessions.push(session);

    session.on('progress', function(response) {
        console.log("session on progress", session, response);
    });

    session.on('accepted', function(data) {
        console.log("session on accepted", session, data);
    });

    //called when a response 300-699 is received
    session.on('rejected', function(response, cause) {
        console.log("session on rejected", session, response, cause);
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
        console.log("session on failed", session, response, cause);
    });

    session.on('terminated', function(response, cause) {
        console.log("session on terminated", session, response, cause);
    });

    session.on('cancel', function() {
        console.log("session on cancel", session);
    });

    session.on('reinvite', function(a_session) {
        console.log("session on reinvite", session, a_session);
    });

    session.on('referRequested', function(context) {
        console.log("session on referRequested", session, context);
    });

    session.on('replaced', function(newSession) {
        console.log("session on replaced", session, newSession);
    });

    session.on('dtmf', function(request, dtmf) {
        console.log("session on dtmf", session, request, dtmf);
    });

    session.on('SessionDescriptionHandler-created', function() {
        console.log("session on SessionDescriptionHandler-created", session);
    });

    session.on('directionChanged', function() {
        console.log("session on directionChanged", session);
    });

    session.on('trackAdded', function() {
        console.log("session on trackAdded", session);
    });

    session.on('bye', function(request) {
        console.log("session on bye", session, request);
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

    func(txtWebSocket, 'txtWebSocket');
    func(txtURI, 'txtURI');
    func(txtAuthorizationUser, 'txtAuthorizationUser');
    func(txtDisplayName, 'txtDisplayName');
    func(txtPassword, 'txtPassword');
    console.log(JSON.stringify(localStorage, false, 4));
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

    document.getElementById("txtWebSocket").value = localStorage.getItem("txtWebSocket");
    document.getElementById("txtURI").value = localStorage.getItem("txtURI");
    document.getElementById("txtAuthorizationUser").value = localStorage.getItem("txtAuthorizationUser");
    document.getElementById("txtDisplayName").value = localStorage.getItem("txtDisplayName");
    document.getElementById("txtPassword").value = localStorage.getItem("txtPassword");
}

window.onload = function() {

    //var uaStatus = document.getElementById('ua-status');
    var ua;
    var userAgent = new SIP.UA(ua);

    loadFields();

    window.userAgent = userAgent;
    userAgent.on('invite', function(session) {
        setupSession(session);
        session.accept();
    });

    //Function from register button
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
        userAgent = new SIP.UA(ua);
        userAgent.register();
        saveConfig();
    });

    //Function from untregister button
    var desregButton = document.getElementById('unregister');
    desregButton.addEventListener('click', function() {
        userAgent.unregister();
    });

    //Function to end a call at Incoming call section
    var endButtonic = document.getElementById('dropCallic');
    endButtonic.addEventListener("click", function() {
        session.bye();
        //alert("Call Ended");
    }, false);

    //Function to end a call at Outgoing call section
    var endButtonoc = document.getElementById('dropCalloc');
    endButtonoc.addEventListener("click", function() {
        session.bye();
        //alert("Call Ended");
    }, false);

    //Function to end a call at Click to call section
    var endButtonctc = document.getElementById('endCallctc');
    endButtonctc.addEventListener("click", function() {
        session.bye();
        //alert("Call Ended");
    }, false);

    userAgent.on('registered', function() {
        uaStatus.innerHTML = 'Registered';
    });

    userAgent.on('unregistered', function() {
        uaStatus.innerHTML = 'Unregistered';
    });

    function onInvite(invitation) {
        invitation.accept();
    }

    function onInvite(invitation) {
        invitation.reject();
    }

    //makes a call at section Outgoing Call, only registered
    var startButtonoc = document.getElementById("startCalloc");
    startButtonoc.addEventListener("click", function() {
        var session = userAgent.invite(txtTarget.value, {
            sessionDescriptionHandlerOptions: {
                constraints: {
                    audio: true,
                    video: false
                }
            }
        });
        setupSession(session);
    }, false);

    //makes a call at section Click to Call
    var startButtonctc = document.getElementById("startCallctc");
    startButtonctc.addEventListener("click", function() {
        var session = userAgent.invite(txtTarget.value, {
            sessionDescriptionHandlerOptions: {
                constraints: {
                    audio: true,
                    video: false
                }
            }
        });
        setupSession(session);
    }, false);

    //Cancel the call at section Outgoing call
    var cancelButtonoc = document.getElementById("cancelCalloc");
    cancelButtonoc.addEventListener("click", function() {
        session.terminate();
    }, false);

    var checkRegButton = document.getElementById("checkRegister");
    checkRegButton.addEventListener("click", function() {
        var estado = userAgent.isRegistered();
        if (estado == true)
            alert("User is registered!");
        else
            alert("User is unregistered");
    }, false);

}