const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const corsOptions = {
    origin: '*',
    methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'UPDATE'],
    credentials: true
};
const uuidv4 = require('uuid/v4');

const port = process.env.PORT || 8080;
const app = express();

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/tasks');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(err, success) {
	if (err) {
		console.log(err);
	} else {
		console.log('Connected to db');
	}
});

var userSchema = new mongoose.Schema({
	userID : String,
	userTasks : [{
		name : String,
		taskID : String
	}]
});

var User = mongoose.model('User', userSchema);

app.use(bodyParser.json());
app.use(cors(corsOptions));

app.use(function (error, req, res, next) {
    if (error instanceof SyntaxError) {
        res.status(400).send({
            errorCode: 'PARSE_ERROR',
            message: 'Arguments could not be parsed, make sure request is valid.'
        });
    } else {
        res.status(500).send('Something broke server-side.', error);
    }
});

app.get('/', function(req, res) {
    res.send('Welcome to Lab 7 API.');
});

app.post('/users', function(req, res) {
    const userId = uuidv4();
    var newUser = new User({
		userID: userId
	});

    newUser.save(function (err) {
		if (err) return console.log(err);
	});

    return res.status(200).send(JSON.stringify({'id': userId}));
});

app.get('/:userId/tasks', function(req, res) {
    const userId = req.params.userId;

    ensureUserExist(userId, res, function(err) {
    	if (err == true) {
			let tasks = [];

			getUserTasks(userId, function (tasks) {
				this.tasks = tasks;
				return res.status(200).send(JSON.stringify({'userTasks': tasks}));
			});
		} else {
			return res.status(400).send('User with id \'' + userId + '\' doesn\'t exist.');
		}
    });
});

app.post('/:userId/tasks', function(req, res) {
    const userId = req.params.userId;

    ensureUserExist(userId, res, function(err) {
    	if (err == true) {
			ensureValidTask(req.body, res, function () {
				const task = {taskID: uuidv4(), name: req.body.name};

				User.findOneAndUpdate({userID: userId}, {$push: {userTasks: task}},
						function (error) {
							if (error) {
								console.log(error);
							}
						});
				return res.status(200).send(JSON.stringify(task));
			});
		} else {
			return res.status(400).send('User with id \'' + userId + '\' doesn\'t exist.');
		}
	});
});

app.put('/:userId/tasks/:taskId', function(req, res) {
	const taskId = req.params.taskId;
	const userId = req.params.userId;

	ensureUserExist(userId, res, function(err) {
		if (err == true) {
			ensureValidTask(req.body, res, function() {
				editTasks(userId, taskId, req, function (tasks, updatedTask) {
					if (updatedTask.length != 0) {
						User.findOneAndUpdate({userID: userId}, {$set: {userTasks: tasks}},
								function (error) {
									if (error) {
										console.log(error);
									}
								});
						return res.status(200).send(JSON.stringify(updatedTask));
					} else {
						return res.status(400).send('Task with id \'' + taskId + '\' doesn\'t exist.');
					}
				});
			});
		} else {
			return res.status(400).send('User with id \'' + userId + '\' doesn\'t exist.');
		}
	});
});

function editTasks(userId, taskId, req, callback) {
	getUserTasks(userId, function (tasks) {
		var updatedTask = [];
		tasks.forEach(function(task, index) {
			if (task.taskID === taskId) {
				task.name = req.body.name;
				updatedTask = task;
			}
		});
		callback(tasks, updatedTask);
	});
}

app.delete('/:userId/tasks/:taskId', function(req, res) {
	const taskId = req.params.taskId;
	const userId = req.params.userId;

	ensureUserExist(userId, res, function (err) {
		if (err == true) {
			deleteTasks(userId, taskId, req, function (tasks, taskFound) {
				if (taskFound == true) {
					User.findOneAndUpdate({userID: userId}, {$set: {userTasks: tasks}},
							function (error) {
								if (error) {
									console.log(error);
								}
							});
					return res.sendStatus(204);
				} else {
					return res.status(400).send('Task with id \'' + taskId + '\' doesn\'t exist.');
				}
			});
		} else {
			return res.status(400).send('User with id \'' + userId + '\' doesn\'t exist.');
		}
	});
});

function deleteTasks(userId, taskId, req, callback) {
	getUserTasks(userId, function (tasks) {
		var taskFound = false;
		tasks.forEach(function(task, index) {
			if (task.taskID === taskId) {
				tasks.splice(index, 1);
				taskFound = true;
			}
		});
		callback(tasks, taskFound);
	});
}

app.listen(port, function() {
    console.log('Server listening.')
});

function ensureValidTask(task, res, callback) {
    if (task.name === undefined || task.name === '') {
        return res.status(400).send('Task definition is invalid.');
    }

    callback();
}

function ensureUserExist(userId, res, callback) {
    User.find({ userID : userId}, function(err, user) {
    	if (user[0] == null) {
    		callback(false);
		} else {
    		callback(true);
		}
	});
}

function getUserTasks(userId, callback) {
	let tasks = [];

	User.find({ userID : userId}, function (err, user) {
		if (err) {
			console.log(err);
			return [];
		}

		tasks = user[0].userTasks;
		callback(tasks);
	});
}