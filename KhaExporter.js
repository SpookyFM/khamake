var korepath = require('./korepath.js');
var Exporter = require(korepath + 'Exporter.js');
var Files = require(korepath + 'Files.js');
var path = require('path');

var KhaExporter = function (khaDirectory) {
	Exporter.call(this);
	this.width = 640;
	this.height = 480;
	this.sources = [];
	this.addSourceDirectory('Sources');
	this.addSourceDirectory(path.join(khaDirectory.toString(), 'Sources'));
};

KhaExporter.prototype = Object.create(Exporter.prototype);
KhaExporter.constructor = KhaExporter;

KhaExporter.prototype.getCurrentDirectoryName = function (directory) {
	return directory.getFileName();
};

KhaExporter.prototype.copyFile = function (from, to) {
	Files.copy(from, to, true);
};

KhaExporter.prototype.copyDirectory = function (from, to) {
	this.createDirectory(to);
	var files = Files.newDirectoryStream(from);
	for (var f in files) {
		var file = Paths.get(from, files[f]);
		if (Files.isDirectory(file)) this.copyDirectory(file, to.resolve(file));
		else this.copyFile(file, to.resolve(file));
	}
};

KhaExporter.prototype.createDirectory = function (dir) {
	if (!Files.exists(dir)) Files.createDirectories(dir);
};

KhaExporter.prototype.setWidthAndHeight = function (width, height) {
	this.width = width;
	this.height = height;
};

KhaExporter.prototype.addShader = function (shader) {

};

KhaExporter.prototype.addSourceDirectory = function (path) {
	this.sources.push(path);
};

KhaExporter.prototype.removeSourceDirectory = function (path) {
	for (var i in this.sources) {
		if (this.sources[i] === path) {
			this.sources.splice(i, 1);
			return;
		}
	}
};

KhaExporter.prototype.copyImage = function (platform, from, to, asset, callback) { callback(); };
KhaExporter.prototype.copyMusic = function (platform, from, to, encoders, callback) { callback(); };
KhaExporter.prototype.copySound = function (platform, from, to, encoders, callback) { callback(); };
KhaExporter.prototype.copyVideo = function (platform, from, to, encoders, callback) { callback(); };
KhaExporter.prototype.copyBlob = function (platform, from, to, callback) { callback(); };

module.exports = KhaExporter;
