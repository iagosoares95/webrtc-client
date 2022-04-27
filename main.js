"use strict";

var state = {
    ready: false,
    config: undefined,
    userAgent:  undefined,
    registerer: undefined,    
    session: undefined,
    sessionOptions: {
        sessionDescriptionHandlerOptions: { 
            constraints: { audio: true, video: true }
        },
        sessionDescriptionHandlerModifiers: codecSelector
    },
    remoteAddr: undefined,
};

const leftVideo = document.querySelector("#leftVideo");
const rightVideo = document.querySelector("#rightVideo");
const debugButton = document.querySelector("button#debug");

//debugButton.onclick = makeVideoCall;
debugButton.onclick = debugAudioCodecs;

const configFieldNames = [ 'WsServer', 'AuthUser', 'Password' ];
//loads and populates the fields
function loadConfig() {
    var config = {};
    for( const name of configFieldNames ) {
        var value = localStorage.getItem(document.location.pathname + "config." + name);
        if( !value ) {
            continue;
        }
        config[name] = value;
        var elem = document.getElementById("edt_" + name);
        if(elem) {
            elem.value = value;
        }
    };
    return config;
}

//saves the information from the fields
function saveConfig() {
    var config = {};
    for( const name of configFieldNames ) {
        var elem = document.getElementById("edt_" + name);
        if( elem ) {
            localStorage.setItem(document.location.pathname + "config." + name, elem.value);
            config[name] = elem.value;
        }
    }
    return config;
}

function isRegistered() {
    return state.registerer &&
        state.registerer.state == SIP.RegistererState.Registered;
}

function initSession(session) {
    state.session = session;
    session.stateChange.addListener((new_state)=>{
        if( state.session !== session) {
            return; //session was changed, just ignore...
        }
        applog(`session state changed: to ${new_state}`);
        switch (new_state) {
            case SIP.SessionState.Initial:
                break;
            case SIP.SessionState.Establishing:
                break;
            case SIP.SessionState.Established:
                ringControl( false, false );
                setupLocalMedia();
                setupRemoteMedia();
                break;
            case SIP.SessionState.Terminating:
            // fall through
            case SIP.SessionState.Terminated:
                state.session = undefined;
                cleanupMedia();
                ringControl( false, false );
                break;
            default:
                throw new Error("Unknown session state.");
        } 
        updateUI();
    });
    updateUI();
}

function makeCall(arg_options = null) {
    if(!isRegistered()) {
        applog("Register first!");
        return;
    }
    const targetfield = document.getElementById('edt_TargetNumber');
    const targeturi = state.userAgent.options.uri.clone();
    targeturi.user = targetfield.value;

    state.remoteAddr = targeturi.user;

    let call_options = state.sessionOptions;
    if(arg_options !== null) {
        call_options = arg_options;
    }

    const inviter = new SIP.Inviter(state.userAgent, targeturi, call_options);
    initSession(inviter);
    inviter.invite(call_options)
        .then((request)=>{ 
            state.remoteAddr = targeturi.user;
            applog("Sent INVITE"); 
            ringControl( true, false );
        })
        .catch((error)=>{
            applog("Invite error");
            applog(error.toString());
        })
}

function makeVideoCall() {
    const options = {
        sessionDescriptionHandlerOptions: {
            constraints: { audio: true, video: true },
        }
    };
    makeCall(options);
}

function debugAudioCodecs() {
    const {codecs} = RTCRtpSender.getCapabilities('audio');
    console.log(codecs);
    const filtered = codecs.filter(c => c.clockRate == 8000);
    console.log(filtered);
}

function answerCall() {
    if(!state.session) {
        applog("no session to answer!");
        return;
    }
    state.session.accept(state.sessionOptions);
}

var uaDelegate = {
    onConnect: () => {
        applog( "Connected to the server");
    },
    onDisconnect: (error) => {
        applog( "Disconnected from server");
        state.registerer = undefined;
    },
    onInvite: (invitation) => {
        applog( "Received INVITE");
        if( state.session ) {
            applog("Session already in progress, rejecting...");
            invitation.reject()
                .then(()=>{
                    applog("INVITE Rejected");
                })
                .catch((error)=>{
                    applog("Failed to reject INVITE");
                    applog(error.toString());
                });
        }
        state.remoteAddr = invitation.request.from.uri.user;
        applog(`<b>Call from: ${state.remoteAddr}</b>`);
        ringControl( true, true );
        initSession(invitation);
    },
    onMessage: (message) => {
        applog( "onMessage");
        applog(message.toString());
    }
};

function codecSelector(offer) {
    console.log("SDP: " + offer.sdp);
    return offer;
}

function initUserAgent(state) {
    if(state.ready)
        return true;

    const config = state.config;
    // validate the config
    for( const name of configFieldNames ) {
        if( !(name in config) || !(typeof config[name] == "string") ) {
            applog("Please fill the configuration...", name);
            return false;
        }
    }

    const transportOptions = {
        server: "wss://" + config.WsServer
    };
    const uristr = "sip:" + config.AuthUser + "@" + config.WsServer;
    const uri = SIP.UserAgent.makeURI(uristr);
    const userAgentOptions = {
        authorizationUsername: config.AuthUser,
        authorizationPassword: config.Password,
        transportOptions,
        uri,
        sessionDescriptionHandlerFactoryOptions: {
            sessionDescriptionHandlerModifiers: codecSelector
        }
    };

    state.userAgent = new SIP.UserAgent(userAgentOptions);
    state.userAgent.delegate = uaDelegate;
    state.userAgent.start()
        .then(()=>{
            state.ready = true;
            applog("We are ready");
            doRegisterAction();
        })
        .catch(()=>{
            applog("Could not start UserAgent");
        })
    return true;
}

function doRegisterAction() {
    state.config = saveConfig();
    if( !initUserAgent(state) )
        return;

    if( isRegistered() ) {
        applog("Sending unREGISTER");
        state.registerer.unregister();
        return;
    }    

    state.registerer = new SIP.Registerer(state.userAgent);
    state.registerer.stateChange.addListener((new_state) => {
        switch (new_state) {
            case SIP.RegistererState.Initial:
                // label.innerText = "Registering";
                break;
            case SIP.RegistererState.Registered:
                applog("Registered!");
                // label.innerText = "Registered";
                // button.innerText = "Unregister";
                break;
            case SIP.RegistererState.Unregistered:
                applog("Unregistered");
                // label.innerText = "Unregistered";
                // button.innerText = "Register";
                break;
            case SIP.RegistererState.Terminated:
                state.registerer = undefined;
                // label.innerText = "Unregistered";
                applog("registration terminated");
                break;
            default:
                applog("unknonwn registerer state: ", new_state);
                throw new Error("Unknown registerer state.");
        }
        updateUI();
    });
    applog("Sending REGISTER")
    state.registerer.register();
    updateUI();
}

function doStartCall() {
    if(state.session) {
        answerCall();
    } else {
        makeCall();
    }
}

function doHangupCall() {
    if(!state.session) {
        applog("no session to hangup");
        return;
    }
    state.remoteAddr = undefined;

    if (state.session instanceof SIP.Inviter) {
        switch(state.session.state) {
            case SIP.SessionState.Initial:
            case SIP.SessionState.Establishing:
                return state.session.cancel().then(()=>{applog("Sent CANCEL"); });
            case SIP.SessionState.Established:
                return state.session.bye().then(()=>{applog("Sent BYE"); });
        }
    } else if (state.session instanceof SIP.Invitation) {
        switch(state.session.state) {
            case SIP.SessionState.Initial:
            case SIP.SessionState.Establishing:
                return state.session.reject().then(()=>{applog("Invitation rejected"); });
            case SIP.SessionState.Established:
                return state.session.bye().then(()=>{applog("Sent BYE"); });
        }
    } else {
        applog("unknown session type!");
    }
}

function setupLocalMedia() {
    if (!state.session || !state.session.sessionDescriptionHandler ) {
        applog("setupLocalMedia - invalid state");
        return;
    }
    if(!state.sessionOptions.sessionDescriptionHandlerOptions.constraints.video) {
        //no local video
        return;
    }
    const {peerConnection} = state.session.sessionDescriptionHandler;
    const sender = peerConnection.getSenders().find(s => s && s.track && s.track.kind === 'video');
    if(!sender) {
        applog("setupLocalMedia - no local video track");
        return;
    }
    const {track} = sender;
    const localStream = new MediaStream([track]);
    leftVideo.srcObject = localStream;
    leftVideo.volume = 0;
    leftVideo.play()
        .then( _ => { applog("local video setup")})
        .catch(error => {
            applog("Error settting up local video");
            applog(error.message);
        })
}


function setupRemoteMedia() {
    if (!state.session) {
        applog("setupRemoteMedia - no session");
        return;
    }
    const sessionDescriptionHandler = state.session.sessionDescriptionHandler;
    if (!sessionDescriptionHandler) {
        applog("setupRemoteMedia - no session description handler");
        return;
    }
    const peerConnection = sessionDescriptionHandler.peerConnection;
    const audioReceiver = peerConnection.getReceivers().find(r => {
        return r && r.track && r.track.kind === 'audio';
    });
    const videoReceiver = peerConnection.getReceivers().find(r => {
        return r && r.track && r.track.kind === 'video';
    });

    if( !audioReceiver && !videoReceiver ) {
        applog("setupRemoteMedia - no remote tracks");
        return;
    }

    const remoteStream = new MediaStream();
    if(audioReceiver) {
        remoteStream.addTrack(audioReceiver.track);
    }
    if( videoReceiver) {
        remoteStream.addTrack(videoReceiver.track);
    }

    rightVideo.srcObject = remoteStream;
    rightVideo.play()
        .then(()=>{applog("remote media setup")})
        .catch((error) => {
            applog("Error playing remote media");
            applog(error.message);
        });
}

function cleanupMedia() {
    const mediaElement = state.controls.remoteAudio;
    mediaElement.srcObject = null;
    mediaElement.pause();
}

function ringControl( start, incoming ) {
    const effectsElem = state.controls.effects;
    if(start) {
        effectsElem.src = incoming ? 'ring_in.mp3' : 'ring_out.mp3';
        effectsElem.play();
        effectsElem.loop = true;
    } else {
        effectsElem.pause();
    }
}

function escapeHtml(text) {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        "/": '&#x2F;'
    };
    
    return text.replace(/[&<>"'\/]/g, function(m) { return map[m]; });
}

function applog() {
    const logger = document.getElementById('log');
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == 'object') {
            logger.innerHTML += ((JSON && JSON.stringify) ? JSON.stringify(arguments[i], undefined, 2) : arguments[i]) + ' ';
        } else {
            logger.innerHTML += arguments[i] + ' ';
        }
    }
    logger.innerHTML += "</br>";
    logger.scrollTop = logger.scrollHeight;
}

function updateUI() {
    let start = state.controls.startCall;
    let stop = state.controls.stopCall;
    let reg = state.controls.registerAction;
    let regstt = state.controls.regStatus;
    let callid = state.controls.callerId;

    if(state.registerer) {
        switch(state.registerer.state) {
            case SIP.RegistererState.Initial:
                regstt.innerText = "Registering";
                break;
            case SIP.RegistererState.Registered:
                regstt.innerText = "Registered";
                reg.innerText = "Unregister";
                break;
            case SIP.RegistererState.Unregistered:
                regstt.innerText = "Unregistered";
                reg.innerText = "Register";
                break;
            case SIP.RegistererState.Terminated:
                regstt.innerText = "Unregistered";
                break;
        }
    }
    else 
    {
        start.disabled = true;
        stop.disabled = true;
    }

    if( state.session ) {
        let incoming = (state.session instanceof SIP.Invitation);
        switch(state.session.state) {
            case SIP.SessionState.Initial:
            case SIP.SessionState.Establishing:
                stop.disabled = false;
                stop.innerText = incoming ? "Reject" : "Cancel Call";
                start.innerText = incoming ? "Answer call" : "Make Call";

                callid.innerText = (incoming ? "Incoming from: " : "Calling: " ) + state.remoteAddr;

                start.disabled = !incoming;
                break;
            case SIP.SessionState.Established:
                stop.disabled = false;
                stop.innerText = "Hangup";

                callid.innerText = "Connected to: " + state.remoteAddr;

                start.disabled = true;
                break;
            default:
                start.disabled = false;
                start.innerText = "Make Call";

                callid.innerText = "";

                stop.disabled = true;
                break;
        }
    }
    else
    {
        start.disabled = false;
        start.innerText = "Make Call";

        callid.innerText = "";

        stop.disabled = true;
        stop.innerText = "Hangup";
    }
}

window.onload = function () {
    //bind buttons
    var controls = {};
    controls.remoteAudio = document.getElementById('remoteAudio');
    controls.effects = document.getElementById('effects');
    controls.startCall = document.getElementById("btStartCall");
    controls.stopCall = document.getElementById("btStopCall");
    controls.callerId = document.getElementById('lbl_callerid');
    controls.regStatus = document.getElementById("lbl_regstatus");
    controls.registerAction = document.getElementById('btRegisterAction');
    state.controls = controls;

    controls.registerAction.addEventListener('click', doRegisterAction);
    controls.startCall.addEventListener('click', doStartCall);
    controls.stopCall.addEventListener('click', doHangupCall);
    controls.stopCall.disabled = true;

    state.config = loadConfig();
    initUserAgent(state);

}
