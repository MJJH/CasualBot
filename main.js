// Constants
const 
	Discord = require("discord.js"),
	Scheduler = require('node-cron'),
        options = require('./options.js'),
	lowdb = require('lowdb'),
	fs = require('lowdb/adapters/FileSync'),
	update = .5 * 60 * 1000,
	points = {
		online: .1,
		chat: 2,
		voice: 1,
		night_bonus: 1.5,
		party_bonus: 1.2
	},
	output = {
		day: 6,
		second: 0,
		minute: 0,
		hour: 0
	},
        days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'],
	client = new Discord.Client({ 
		sync: true,
		/* messageSweepInterval: update / 1000,*/ 
		fetchAllMembers: true, 
		messageCacheMaxSize: -1 
	}),
	top = 20,
	input_channel = [ '195633561439698945', '317406295202332672' ],
	output_channel = '317406295202332672',
	server_id = '95891329841627136',
        super_admin = '95891032310296576',
	
	db_path = 'db.json',
	adapter = new fs(db_path),
	db = lowdb(adapter),
	hardcore = {start: 0, end: 7},
        autilords = 1,
	aulites = 3,
	admin_actions = {
		top: (t) => { top = parseInt(t); },
		chat: (t) => { points.chat = parseFloat(t); },
		voice: (t) => { points.voice = parseFloat(t); },
		online: (t) => {points.online = parseFloat(t); },
		night: (t) => { points.night_bonus = parseFloat(t); },
		party: (t) => { points.party_bonus = parseFloat(t); },
		aulite: (t) => { aulites = parseInt(t); },
		autilord: (t) => { autilords = parseInt(t); },
		restart: (c) => { if (c === 'MartijnIsCool') reset_week(); },
		hardcore: (t) => { var split = t.split("-"); hardcore.start = parseInt(split[0]); hardcore.end = parseInt(split[1]); },
		output: (t) => { output_channel = t },
		input: (t) => { input_channel.indexOf(t) >= 0 ? input_channel.splice(input_channel.indexOf(t), 1) : input_channel.push(t); }
	};
	

// Variables
var
	chatter = [],
	server = null,
	session = -1;
	

// Database
db._.mixin({
	filter_func: function (array, check) {
		var arr = [];
		
		array.forEach((val, index, cb) => {
			if (check(val))
				arr.push(val);
		});
		
		return arr;
	},
	sum_points: function (array) {
		var total = [];
		
		if (!array) return total;
		
		array = [].concat(array);

		array.forEach(function(val, k) {
			var sum = 0;
			
			sum += val.day.online * points.online;
			sum += val.day.chat * points.chat;
			sum += val.day.voice * points.voice;
			// ---
			sum += val.night.online * points.online * points.night_bonus;
			sum += val.night.chat * points.chat * points.night_bonus;
			sum += val.night.voice * points.voice * points.night_bonus;
			
			total.push({ user: val.user_id, points: sum });
		});
		return total;
	},
	last: (array) => array[array.length-1],
	sort: (array, sort_func) => array.sort(sort_func),
	_has: (array, ffilter) => ffilter(array)
});

db.defaults({ point_system: [ ], session: [ ], options: { } }).write();

	
// Discord	
client.on('ready', function() {
	console.log('Bot online: ' + client.user.tag);
	
	session = getSession();
	if (session < 0)
		createSession();
	
	// Get bananen
	server = client.guilds.array()[
		client.guilds.keyArray().indexOf(server_id)
	];
	
	//givePoints('3453453453453453453453', 'chat', 2.3);
});
client.on('message', (message) => {
	// Check for channel
	if ( chatter.indexOf(message.author.id) < 0 && !message.author.bot ) {
		chatter.push(message.author.id);
	}
	
	if ( input_channel.indexOf(message.channel.id) >= 0 && !message.author.bot ) {
		var content = message.content.split(' ');
		if (content[0] === "?points") {
			var user = getUser(message.author.id) || {day: {voice:0,chat:0,online:0}, night: {voice:0,chat:0,online:0}};
			message.channel.send(
			[
			message.author + " (#" + getRanking(message.author.id) + ") heeft *" + (Math.round(getPoints(message.author.id).points * 100) / 100) + "* punten.",
			"Deze zijn behaald door: ",
			" - Online tijd:", ":sunny: " + Math.round(user.day.online * points.online * 100) / 100, ":full_moon: " + Math.round(user.night.online * points.online * points.night_bonus * 100) / 100,
			" - Chat berichten:", ":sunny: " + Math.round(user.day.chat * points.chat * 100) / 100, ":full_moon: " + Math.round(user.night.chat * points.chat * points.night_bonus * 100) / 100,
			" - Gespreks tijd:", ":sunny: " + Math.round(user.day.voice * points.voice * 100) / 100, ":full_moon: " + Math.round(user.night.voice * points.voice * points.night_bonus * 100) / 100,
			].join("\n"), {split: true}
			);
		} else if(content[0] === "?top") {
			message.channel.send(getOutput((array) => {
				if (content.length === 1)
					return array;
				
				var na = [];
				array.forEach((v, i, c) => {
					var user = server.members.filter((z) => z.id === v.user_id).first();
					
					if (user.roles.map((x) => x.name.toLowerCase()).indexOf(content[1].toLowerCase()) >= 0) {
						na.push(v);
					}	
					
				});
				return na;
			}), {split: true, code: true});
		} else if(content[0] === '?settings') {
			if (message.author.id === super_admin && content.length > 1) {
				// try {
					admin_actions[content[1]](content[2]);
				/*} catch (e) {
					console.log(e.message);
					var bal = server.emojis.filter((e) => e.name.toLowerCase() === 'bal').first();
					message.react(bal);
				}*/
			}
			
			var out = server.channels.filter((c) => c.id === output_channel).first().name,
				inp = server.channels.filter((c) => input_channel.indexOf(c.id) >= 0).map((x) => "#" + x.name);
			
			message.channel.send(
			['Update-timer: ' + (update / 1000) + ' seconden', 
			'Uitreiking: Elke '+days[output.day]+' om '+ [fz(output.hour), fz(output.minute), fz(output.seconds)].join(":") + ' in #' + out,
			'Input mogelijk in: [' + inp.join(", ") + ']',
			'Punten: online ('+points.online+'), chat ('+points.chat+'), voice ('+points.voice+')', 
			'Midnight multiplier ['+hardcore.start+'-'+hardcore.end+' uur] (*'+ points.night_bonus +')',
			'Party bonus ('+points.party_bonus+' ^ connecties)',
			'Aantal rollen: AutiLords ('+autilords+'), Aulite ('+aulites+')',
			'Top lijst ('+top+')'].join("\n"), {split: true, code: true});
		}
	}
});
client.setInterval( function (args) {
	// check Points	
	while (chatter.length > 0) {
		givePoints(chatter.pop(), 'chat');
	}
	
	// Check online
	server.members.filter((v) => (v.presence.status === 'online' && !v.user.bot)).forEach((v, k, m) => {
		givePoints(k, 'online');
	});
	
	// Check voice
	server.members.filter((v) => v.voiceChannel !== undefined && !v.selfMute && !v.serverMute && v.presence.status === 'online' && !v.user.bot).forEach((v, k, m) => {
		var found = v.voiceChannel.members.filter((m) => !m.user.bot && !m.selfMute && !m.serverMute && v.presence.status === 'online').array().length;
		if (found > 0)
			givePoints(k, 'voice', Math.pow(points.party_bonus, found - 1));
	});
}, update, {});

var sched = Scheduler.schedule([output.second, output.minute, output.hour, '*', '*', output.day].join(" "), () => {
	reset_week();
});
client.on('disconnect', () => {
	sched.destroy();
});

client.login(options.bot_key);

// Functions
var givePoints = function (user_id, type, amount) {
	// Get old
	var scores = getUser(user_id);
	// Create account
	if (!scores) {
		scores = db.get('point_system').push(
			{ 
				'user_id': user_id, 'session': session, 
				'day': { 'online': 0, 'chat': 0, 'voice': 0 },
				'night': { 'online': 0, 'chat': 0, 'voice': 0 } 
			}).write();
		scores = scores[scores.length - 1];
	}	
	amount = amount || 1;
	
	// Add new
	var now = new Date(), update = {};
	if (now.getHours() >= hardcore.start && now.getHours() < hardcore.end)
		update = { night: { online: scores.night.online + (type === 'online' ? amount : 0), chat: scores.night.chat + (type === 'chat' ? amount : 0), voice: scores.night.voice + (type === 'voice' ? amount : 0) } };
	else
		update = { day: { online: scores.day.online + (type === 'online' ? amount : 0), chat: scores.day.chat + (type === 'chat' ? amount : 0), voice: scores.day.voice + (type === 'voice' ? amount : 0) } };
	
	db.get('point_system').filter({ 'user_id': user_id, 'session': session }).first().assign(update).write();
},
getUser = function (user_id) {
	return db.get('point_system')
	.filter({ 'user_id': user_id, 'session': session })
	.first().value();
},
getPoints = function (user_id) {
	return db.get('point_system')
	.filter({ 'user_id': user_id, 'session': session })
	.sum_points().first().value() || {points: 0, user: user_id};
},
getOutput = function (filter) {
	var list =  [
		'# Casualbot rankings:'
	], sorted = [];
	
	filter = filter || ((array) => array);
	
	db.get('point_system').filter({ 'session': session })._has(filter).sum_points().sort(sort_list).take(top).value().forEach(function(val, i) {
		var member = server.members.find((v) => v.id === val.user);
		
		list.push("# " + (i+1) + ". " + member.displayName + " {" + Math.round(val.points) + "}");
	});
	list.push("# ------");
	return list.join("\n");
},
getRanking = function (user_id) {
	var list = db.get('point_system').filter({ 'session': session }).sum_points().sort(sort_list).value();
	for (var i = 0, l = list.length; i < l; i++) {
		if (list[i].user === user_id)
			return i+1;
	}
	return -1;
},
sort_list = (a, b) => {
	//if (a.val == b.val)
	//	return b.role - a.role;
	return b.points - a.points;
},
getSession = function () {
	var last = db.get('session').last().value();
	return last ? last.id : -1;
},
createSession = function () {
	var sessions = db.get('session').push({ id: (session + 1), date: new Date().getTime() }).last().write().id;
	session = sessions;
},
reset_week = function () {
	// Output
	var f = (array) => {
				var na = [];
				array.forEach((v, i, c) => {
					var user = server.members.filter((z) => z.id === v.user_id).first();	
					if (user.roles.map((x) => x.name.toLowerCase()).indexOf('Autist'.toLowerCase()) >= 0)
						na.push(v);
				});
				return na;
			};
	
	server.channels.find((v) => v.id === output_channel).send(getOutput(f), {split: true, code: true}).then(message => message.pin());
	var order = db.get('point_system').filter({ 'session': session })._has(f).sum_points().sort(sort_list).take(autilords + aulites).value().map(v => v.user);
	
	// Reset
	createSession();
	
	// Update roles
	var autilord = server.roles.filter((v) => v.name.toLowerCase() === 'AutiLord'.toLowerCase()).first(),
		aulite = server.roles.filter((v) => v.name.toLowerCase() === 'Aulite'.toLowerCase()).first();
		
	server.members.filter(v => v.roles.map(x => x.name.toLowerCase()).indexOf('Autilord'.toLowerCase()) >= 0 && order.slice(0, autilords).indexOf(v.id) < 0).forEach(v => {v.removeRole(autilord)});
	server.members.filter(v => v.roles.map(x => x.name.toLowerCase()).indexOf('Aulite'.toLowerCase()) >= 0 && order.indexOf(v.id) < 0).forEach(v => {v.removeRole(aulite)});
	
	for (var i = 0; i < order.length; i++) {
		var user = server.members.filter(u => u.id === order[i]).first();
		
		if (i < autilords) {
			user.addRole(autilord);
		}
		user.addRole(aulite);
	}
},
fz = function (i) {
	if (!i)
		return "00";
	if(i < 10)
		return "0" + i;
	return "" + i;
};
