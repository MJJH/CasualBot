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
	client = new Discord.Client({ 
		sync: true,
		/* messageSweepInterval: update / 1000,*/ 
		fetchAllMembers: true, 
		messageCacheMaxSize: -1 
	}),
	top = 20,
	input_channel = [ '195633561439698945', '317406295202332672' ],
	output_channel = '182396856070832128',
	server_id = '95891329841627136',
	
	db_path = 'db.json',
	adapter = new fs(db_path),
	db = lowdb(adapter),
	hardcore = {start: 0, end: 7};
	

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

db.defaults({ point_system: [ ], session: [ ] }).write();

	
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
			message.channel.send(
			['Update-timer: ' + (update / 1000) + ' seconden', 
			'Punten: online ('+points.online+'), chat ('+points.chat+'), voice ('+points.voice+')', 
			'Midnight multiplier ['+hardcore.start+'-'+hardcore.end+' uur] (*'+ points.night_bonus +')',
			'Party bonus ('+points.party_bonus+' ^ connecties)'].join("\n"), {split: true, code: true});
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
		givePoints(k, 'voice', Math.pow(points.party_bonus, found - 1));
	});
}, update, {});

var sched = Scheduler.schedule([output.second, output.minute, output.hour, '*', '*', output.day].join(" "), () => {
	// Output
	server.channels.find((v) => v.id === output_channel).send(
		getOutput((array) => {
			var na = [];
			
			array.forEach((v, i, c) => {
				var user = server.members.filter((v) => v.id == v.user_id);
				
				if (user.roles.map((x) => x.name).array().indexOf('Autist')) {
					na.push(v);
				}
				return na;
			});
		}), {split: true, code: true}).then(message => message.pin());
	
	// Reset
	createSession();
	
	// Update roles
	
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
		
		//if (member.hasOwnProperty('user') && !member.user.bot)
		//	sorted.push({ key: member.displayName, val: getPoints(k).points, role: member.highestRole.position });
		list.push("# " + (i+1) + ". " + member.displayName + " {" + Math.round(val.points) + "}");
	});
	//sorted.sort(sort_list);
	
	//for (var i = 1; i <= Math.min(top, sorted.length); i++) {
	//	list.push("# " + i + ". " + sorted[i-1].key + " {" + Math.round(sorted[i-1].val) + "}");
	//}
	
	list.push("# ------");
	return list.join("\n"); b
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
};
