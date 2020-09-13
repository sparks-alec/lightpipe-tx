// Settings
var Settings = {
	pipeID: generateKey(),
	maxFramerate: 10,
	server: 'lightpipe.glitch.me'
}
if(localStorage.getItem("Settings")){
	try{
		Settings = JSON.parse(localStorage.getItem("Settings"));
	}catch(err){
		console.log("Error loading Settings")
	}
}

// Pipe data
var Pipe = {
	universes: [],
	sequence: 0,
	droppedPackets: 0,
	lastSend: Date.now()
}



// Set up events
document.addEventListener('DOMContentLoaded', function(){
	document.getElementById("pipe-id-input").value = Settings.pipeID;
	document.getElementById("pipe-id-input").onchange = function(e){
		Settings.pipeID = e.target.value;
		localStorage.setItem("Settings", JSON.stringify(Settings));
	}

	document.getElementById("framerate-select").selectedIndex = [1,2,4,8,10,16].indexOf(Number(Settings.maxFramerate));
	document.getElementById("framerate-select").onchange = function(e){
		Settings.maxFramerate = Number(e.target.value);
		localStorage.setItem("Settings", JSON.stringify(Settings));
	}

	document.getElementById("reload-button").onclick = function(e){
		location.reload(true);
	}

	document.getElementById("universe").innerHTML = Settings.server;

	setInterval(graphView, 1000);


}, false);




// Views
function universeView(){
	var h = "<table class='addresses'>";
	for(var i=0; i<512; i+=32){
		h += "<tr><td>";
		h += Pipe.universes[1].slice(i, i+32).join("</td><td>");
		h += "</tr>";
	}
	h += "</table>";

	h += "<table class='info'><tr>";
	h += "<td>Pipe "+Settings.pipeID+"</td>";
	h += "<td>"+Pipe.droppedPackets+" dropped packets</td>";
	h += "</tr></table>";

	document.getElementById("universe1").innerHTML = h;
}


function graphView(){
	var $graph = document.getElementById("graph");

	var j = 850;
	for(var i = tripTimes.length-Settings.maxFramerate; i>tripTimes.length-(2*Settings.maxFramerate); i--){
		j--;
		if(tripTimes[i]){
			var h = tripTimes[i].delay;
			if(!h){
				h = 0;
			}

			var $bar = document.createElement("div");
			$bar.className = "graphBar";
			$bar.style.marginTop = Math.abs(100-h)+"px";
			tripTimes[i].elem = $bar;
			$graph.prepend($bar);
		}
		if(graph.childNodes[j]){
			$graph.removeChild($graph.childNodes[j]);
		}
	}
}





// sACN
const e131 = require('e131');
var sACN = new e131.Server([0x0001]);
sACN.on('packet', (packet) => {
	if(packet.getPriority()!=0 && packet.getUniverse()==1){
		Pipe.universes[packet.getUniverse()] = packet.getSlotsData();
		sendDMX();
	}
});
sACN.on('PacketCorruption', (err) => {
	console.log("corrupted sACN packet")
});
sACN.on('PacketOutOfOrder', (err) => {
	console.log("received out-of-order packet")
});
sACN.on('error', (err) => {
	console.log(err)
});




// The actual HTTPS part
const https = require('https');
var tripTimes = [];
function sendDMX(){
	if(Date.now()<Pipe.lastSend+(1000/Settings.maxFramerate)){
		return true;
	}

	Pipe.lastSend = Date.now();
	Pipe.sequence++;
	tripTimes[Pipe.sequence] = {sent: Date.now()};

	var data = JSON.stringify({
		pipe: Settings.pipeID,
		u1: Pipe.universes[1].join(","),
		seq: Pipe.sequence
	});
	const options = {
	  hostname: Settings.server,
	  port: 443,
	  path: '/setUniverse',
	  method: 'GET',
	  headers: {
	    'Content-Type': 'application/json',
	    'Content-Length': data.length
	  }
	}
	const req = https.request(options, res => {
		res.on('data', d => {
			if(d.length>100){
				console.log("site broke for a bit there")
				return true;
			}
			var response = JSON.parse(d.toString());
			if(response.status=="ok"){
				indicatorFlash();
				universeView();

				var t = tripTimes[Number(response.sequence)];
				t.received = Date.now();
				t.delay = t.received-t.sent;

			}else if(response.satus="ooo"){
				Pipe.droppedPackets++;
			}else{
				console.log('some other error')
			}
		})
	})
	req.on('error', error => {
		console.error(error)
	})
	req.write(data);
	req.end();
}





// Utilities
var indicatorTimeout;
function indicatorFlash(){
	document.getElementById("indicator").style.opacity = 1;
	clearTimeout(indicatorTimeout)
	indicatorTimeout = setTimeout(function(){
		document.getElementById("indicator").style.opacity = 0;
	}, 100)
}

function generateKey(){
	var k = "";
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
	for(var i=0; i<6; i++){
		k+=chars[Math.round(Math.random()*chars.length)];
	}
	return k;
}

