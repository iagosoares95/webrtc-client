var userAgents = [];
var sessions = [];

var elements = {
    uaStatus: document.getElementById('ua-status'),
};

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
                    wsServers: ['ws://' + uri.host + ':' + uri.port], // ['ws://webrtc.westus.cloudapp.azure.com:15060'],
                    traceSip: true,
                },
                uri: txtURI.value, //'2009@vargas',
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

    func(txtWebSocket, 'org.register.wsServer');
    func(txtURI, 'org.register.uri');
    func(txtAuthorizationUser, 'org.register.authorizationUser');
    func(txtDisplayName, 'org.register.displayName');
    func(txtPassword, 'org.register.password');
    func(txtTarget, 'org.call.target');
    console.log(txtWebSocket);
    console.log(JSON.stringify(localStorage, false, 4));
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

window.onload = function() {
    loadConfig();
    var options = {
        media: {
            local: {
                //video: document.getElementById('localVideo'),
                audio: document.getElementById('localVideo')
            },
            remote: {
                //video: document.getElementById('remoteVideo'),
                // This is necessary to do an audio/video call as opposed to just a video call
                audio: document.getElementById('remoteVideo')
            }
        },
        ua: {
            transportOptions: {
                wsServers: [txtWebSocket.value], // ['ws://webrtc.westus.cloudapp.azure.com:15060'],
                traceSip: true,
            },
            uri: txtURI.value, //'2009@vargas',
            authorizationUser: txtAuthorizationUser.value, //'2009',
            contactName: txtAuthorizationUser.value,
            displayName: txtDisplayName.value, //'',
            password: txtPassword.value, //'1234',
            level: 'debug',
            userAgentString: 'sipjs-X',
        }
    };

    var btnSave = document.getElementById('btnSaveConfig');
    btnSave.addEventListener('click', function() {
        saveConfig();
    })

    //var simple = new SIP.Web.Simple(options);
    var userAgent = new SIP.UA(options.ua);
    window.userAgent = userAgent;
    userAgent.on('invite', function(session) {
        setupSession(session);
        session.accept();
    })

    var regButton = document.getElementById('register');
    regButton.addEventListener('click', function() {
        userAgent.register();
        //simple.register();
    });

    var desregButton = document.getElementById('unregister');
    desregButton.addEventListener('click', function() {
        userAgent.unregister();
    });

    var endButton = document.getElementById('endCall');
    endButton.addEventListener("click", function() {
        session.bye();
        //alert("Call Ended");
    }, false);

    userAgent.on('registered', function() {
        uaStatus.innerHTML = 'Connected (Registered)';
    });

    userAgent.on('unregistered', function() {
        uaStatus.innerHTML = 'Connected (Unregistered)';
    });

    function onInvite(invitation) {
        invitation.accept();
    }

    function onInvite(invitation) {
        invitation.reject();
    }

    //makes the call
    var startButton = document.getElementById("startCall");
    startButton.addEventListener("click", function() {
        var session = userAgent.invite(txtTarget.value, {
            sessionDescriptionHandlerOptions: {
                constraints: {
                    audio: true,
                    video: false
                }
            }
        });
        setupSession(session);
        //simple.call('2008');
    }, false);

    var ctcButton = document.getElementById("clickToCall");
    ctcButton.addEventListener("click", function() {
        var session = userAgent.invite(txtTarget.value, {
            sessionDescriptionHandlerOptions: {
                constraints: {
                    audio: true,
                    video: false
                }
            }
        });
        setupSession(session);
        //simple.call('2008');
    }, false);


}