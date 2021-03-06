var child_process = require('child_process');
var fs = require('fs');
var os = require('os');
var pathlib = require('path');
var exec = require('./exec.js');
var korepath = require('./korepath.js');
var log = require('./log.js');
var Files = require(korepath + 'Files.js');
var GraphicsApi = require('./GraphicsApi.js');
var VrApi = require('./VrApi.js');
var Options = require('./Options.js');
var Path = require(korepath + 'Path.js');
var Paths = require(korepath + 'Paths.js');
var Platform = require('./Platform.js');
var VisualStudioVersion = require('./VisualStudioVersion.js');

var DalvikExporter = require('./DalvikExporter.js');
var FlashExporter = require('./FlashExporter.js');
var Html5Exporter = require('./Html5Exporter.js');
var Html5WorkerExporter = require('./Html5WorkerExporter.js');
var JavaExporter = require('./JavaExporter.js');
var KoreExporter = require('./KoreExporter.js');
var PlayStationMobileExporter = require('./PlayStationMobileExporter.js');
var WpfExporter = require('./WpfExporter.js');
var XnaExporter = require('./XnaExporter.js');

if (!String.prototype.startsWith) {
	Object.defineProperty(String.prototype, 'startsWith', {
		enumerable: false,
		configurable: false,
		writable: false,
		value: function (searchString, position) {
			position = position || 0;
			return this.indexOf(searchString, position) === position;
		}
	});
}

if (!String.prototype.endsWith) {
	Object.defineProperty(String.prototype, 'endsWith', {
		enumerable: false,
		configurable: false,
		writable: false,
		value: function (searchString, position) {
			position = position || this.length;
			position = position - searchString.length;
			var lastIndex = this.lastIndexOf(searchString);
			return lastIndex !== -1 && lastIndex === position;
		}
	});
}

function escapeRegExp(string) {
	return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

String.prototype.replaceAll = function (find, replace) {
	return this.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};

function compileShader(compiler, type, from, to, temp, system, kfx) {
	if (compiler !== '') {
		var compiler_process = child_process.spawn(compiler, [type, from.toString(), to.toString(), temp.toString(), system, kfx]);

		compiler_process.stdout.on('data', function (data) {
			if (data.toString().trim() !== '') log.info('Shader compiler stdout: ' + data);
		});

		compiler_process.stderr.on('data', function (data) {
			if (data.toString().trim() !== '') log.info('Shader compiler stderr: ' + data);
		});
		
		compiler_process.on('error', function (err) {
			log.error('Shader compiler error: ' + err);
		});

		compiler_process.on('close', function (code) {
			if (code !== 0) log.info('Shader compiler process exited with code ' + code);
		});
	}
}

function addShader(project, name, extension) {
	project.shaders.push({file: name + extension, name: name});
}

function addShaders(exporter, platform, project, to, temp, shaderPath, compiler, kfx) {
	if (!Files.isDirectory(shaderPath)) return;
	var shaders = Files.newDirectoryStream(shaderPath);
	for (var s in shaders) {
		var shader = shaders[s];
		var name = shader;
		if (!name.endsWith('.glsl')) continue;
		name = name.substr(0, name.lastIndexOf('.'));
		switch (platform) {
			case Platform.Flash: {
				if (Files.exists(shaderPath.resolve(name + '.agal'))) Files.copy(shaderPath.resolve(name + '.agal'), to.resolve(name + '.agal'), true);
				else compileShader(compiler, 'agal', shaderPath.resolve(name + '.glsl'), to.resolve(name + '.agal'), temp, platform, kfx);
				addShader(project, name, '.agal');
				exporter.addShader(name + '.agal');
				break;
			}
			case Platform.HTML5:
			case Platform.HTML5Worker:
			case Platform.Android:
			case Platform.Tizen:
			case Platform.iOS: {
				if (Options.graphicsApi === GraphicsApi.Metal) {
					if (!Files.isDirectory(to.resolve(Paths.get('..', 'ios-build', 'Sources')))) {
						Files.createDirectories(to.resolve(Paths.get('..', 'ios-build', 'Sources')));
					}
					var funcname = name;
					funcname = funcname.replaceAll('-', '_');
					funcname = funcname.replaceAll('.', '_');
					funcname += '_main';
					fs.writeFileSync(to.resolve(name + ".metal").toString(), funcname, { encoding: 'utf8' });
					if (Files.exists(shaderPath.resolve(name + ".metal"))) Files.copy(shaderPath.resolve(name + ".metal"), to.resolve(Paths.get('..', 'ios-build', 'Sources', name + ".metal")), true);
					else compileShader(compiler, "metal", shaderPath.resolve(name + '.glsl'), to.resolve(Paths.get('..', 'ios-build', 'Sources', name + ".metal")), temp, platform, kfx);
					addShader(project, name, ".metal");
				}
				else {
					if (Files.exists(shaderPath.resolve(name + ".essl"))) Files.copy(shaderPath.resolve(name + ".essl"), to.resolve(name + ".essl"), true);
					else compileShader(compiler, "essl", shaderPath.resolve(name + '.glsl'), to.resolve(name + ".essl"), temp, platform, kfx);
					addShader(project, name, ".essl");
				}
				break;
			}
			case Platform.Windows: {
				if (Options.graphicsApi == GraphicsApi.OpenGL || Options.graphicsApi == GraphicsApi.OpenGL2) {
					if (compiler == "") Files.copy(shaderPath.resolve(name + ".glsl"), to.resolve(name + ".glsl"), true);
					else compileShader(compiler, "glsl", shaderPath.resolve(name + '.glsl'), to.resolve(name + ".glsl"), temp, platform, kfx);
					addShader(project, name, ".glsl");
				}
				else if (Options.graphicsApi === GraphicsApi.Direct3D11 || Options.graphicsApi === GraphicsApi.Direct3D12) {
					if (Files.exists(shaderPath.resolve(name + ".d3d11"))) Files.copy(shaderPath.resolve(name + ".d3d11"), to.resolve(name + ".d3d11"), true);
					else compileShader(compiler, "d3d11", shaderPath.resolve(name + '.glsl'), to.resolve(name + ".d3d11"), temp, platform, kfx);
					addShader(project, name, ".d3d11");
				}
				else {
					if (Files.exists(shaderPath.resolve(name + ".d3d9"))) Files.copy(shaderPath.resolve(name + ".d3d9"), to.resolve(name + ".d3d9"), true);
					else compileShader(compiler, "d3d9", shaderPath.resolve(name + '.glsl'), to.resolve(name + ".d3d9"), temp, platform, kfx);
					addShader(project, name, ".d3d9");
				}
				break;
			}
			case Platform.WindowsApp: {
				if (Files.exists(shaderPath.resolve(name + ".d3d11"))) Files.copy(shaderPath.resolve(name + ".d3d11"), to.resolve(name + ".d3d11"), true);
				else compileShader(compiler, "d3d11", shaderPath.resolve(name + '.glsl'), to.resolve(name + ".d3d11"), temp, platform, kfx);
				addShader(project, name, ".d3d11");
				break;
			}
			case Platform.Xbox360:
			case Platform.PlayStation3: {
				if (Files.exists(shaderPath.resolve(name + ".d3d9"))) Files.copy(shaderPath.resolve(name + ".d3d9"), to.resolve(name + ".d3d9"), true);
				else compileShader(compiler, "d3d9", shaderPath.resolve(name + '.glsl'), to.resolve(name + ".d3d9"), temp, platform, kfx);
				addShader(project, name, ".d3d9");
				break;
			}
			case Platform.OSX:
			case Platform.Linux: {
				if (compiler == "") Files.copy(shaderPath.resolve(name + ".glsl"), to.resolve(name + ".glsl"), true);
				else compileShader(compiler, "glsl", shaderPath.resolve(name + '.glsl'), to.resolve(name + ".glsl"), temp, platform, kfx);
				addShader(project, name, ".glsl");
				break;
			}
			default:
				break;
		}
	}
}

function exportAssets(assets, index, exporter, from, khafolders, platform, encoders, callback) {
	if (index >= assets.length) {
		callback();
		return;
	}
	var asset = assets[index];
	log.info('Exporting asset ' + (index + 1) + ' of ' + assets.length + ' (' + asset.file + ').');
	if (asset.type === 'image') {
		var file;
		if (asset.libdir !== undefined) {
			if (khafolders) file = from.resolve(Paths.get(asset.libdir, 'Assets', 'Graphics', asset.file));
			else file = from.resolve(Paths.get(asset.libdir, asset.file));
		}
		else {
			if (khafolders) file = from.resolve(Paths.get('Assets', 'Graphics', asset.file));
			else file = from.resolve(asset.file);
		}
		exporter.copyImage(platform, file, Paths.get(asset.file), asset, function () {
			exportAssets(assets, index + 1, exporter, from, khafolders, platform, encoders, callback);
		});
	}
	else if (asset.type === 'music') {
		var file;
		if (asset.libdir !== undefined) {
			if (khafolders) file = from.resolve(Paths.get(asset.libdir, 'Assets', 'Sound', asset.file + '.wav'));
			else file = from.resolve(Paths.get(asset.libdir, asset.file + '.wav'));
		}
		else {
			if (khafolders) file = from.resolve(Paths.get('Assets', 'Sound', asset.file + '.wav'));
			else file = from.resolve(asset.file + '.wav');
		}
		exporter.copyMusic(platform, file, Paths.get(asset.file), encoders, function () {
			exportAssets(assets, index + 1, exporter, from, khafolders, platform, encoders, callback);
		});
	}
	else if (asset.type === 'sound') {
		var file;
		if (asset.libdir !== undefined) {
			if (khafolders) file = from.resolve(Paths.get(asset.libdir, 'Assets', 'Sound', asset.file + '.wav'));
			else file = from.resolve(Paths.get(asset.libdir, asset.file + '.wav'));
		}
		else {
			if (khafolders) file = from.resolve(Paths.get('Assets', 'Sound', asset.file + '.wav'));
			else file = from.resolve(asset.file + '.wav');
		}
		exporter.copySound(platform, file, Paths.get(asset.file), encoders, function () {
			exportAssets(assets, index + 1, exporter, from, khafolders, platform, encoders, callback);
		});
	}
	else if (asset.type === 'blob') {
		var file;
		if (asset.libdir !== undefined) {
			if (khafolders) file = from.resolve(Paths.get(asset.libdir, 'Assets', asset.file));
			else file = from.resolve(Paths.get(asset.libdir, asset.file));
		}
		else {
			if (khafolders) file = from.resolve(Paths.get('Assets', asset.file));
			else file = from.resolve(asset.file);
		}
		exporter.copyBlob(platform, file, Paths.get(asset.file), function () {
			exportAssets(assets, index + 1, exporter, from, khafolders, platform, encoders, callback);
		});
	}
	else if (asset.type === 'video') {
		var file;
		if (asset.libdir !== undefined) {
			if (khafolders) file = from.resolve(Paths.get(asset.libdir, 'Assets', 'Video', asset.file));
			else file = from.resolve(Paths.get(asset.libdir, asset.file));
		}
		else {
			if (khafolders) file = from.resolve(Paths.get('Assets', 'Video', asset.file));
			else file = from.resolve(asset.file);
		}
		exporter.copyVideo(platform, file, Paths.get(asset.file), encoders, function () {
			exportAssets(assets, index + 1, exporter, from, khafolders, platform, encoders, callback);
		});
	}
}

function exportProjectFiles(name, from, to, options, exporter, platform, khaDirectory, haxeDirectory, kore, callback) {
if (haxeDirectory.path !== '') exporter.exportSolution(name, platform, khaDirectory, haxeDirectory, from, function () {
		if (haxeDirectory.path !== '' && kore) {
			{
				var out = '';
				out += "var solution = new Solution('" + name + "');\n";
				out += "var project = new Project('" + name + "');\n";
				var files = [];
				files.push("Kha/Backends/Kore/khacpp/src/**.h");
				files.push("Kha/Backends/Kore/khacpp/src/**.cpp");
				files.push("Kha/Backends/Kore/khacpp/include/**.h");
				//"Kha/Backends/Kore/khacpp/project/libs/nekoapi/**.cpp"
				files.push("Kha/Backends/Kore/khacpp/project/libs/common/**.h");
				files.push("Kha/Backends/Kore/khacpp/project/libs/common/**.cpp");
				if (platform === Platform.Windows || platform === Platform.WindowsApp) files.push("Kha/Backends/Kore/khacpp/project/libs/msvccompat/**.cpp");
				if (platform === Platform.Linux) files.push("Kha/Backends/Kore/khacpp/project/libs/linuxcompat/**.cpp");
				files.push("Kha/Backends/Kore/khacpp/project/libs/regexp/**.h");
				files.push("Kha/Backends/Kore/khacpp/project/libs/regexp/**.cpp");
				files.push("Kha/Backends/Kore/khacpp/project/libs/std/**.h");
				files.push("Kha/Backends/Kore/khacpp/project/libs/std/**.cpp");
				//"Kha/Backends/Kore/khacpp/project/libs/zlib/**.cpp"
				files.push("Kha/Backends/Kore/khacpp/project/thirdparty/pcre-7.8/**.h");
				files.push("Kha/Backends/Kore/khacpp/project/thirdparty/pcre-7.8/**.c");
				//"Kha/Backends/Kore/khacpp/project/thirdparty/pcre-7.8/**.cc"
				files.push("Kha/Backends/Kore/*.cpp");
				files.push("Kha/Backends/Kore/*.h");
				files.push((from.relativize(to.resolve(exporter.sysdir() + "-build")).toString() + "/Sources/**.h").replaceAll('\\', '/'));
				files.push((from.relativize(to.resolve(exporter.sysdir() + "-build")).toString() + "/Sources/**.cpp").replaceAll('\\', '/'));
				files.push((from.relativize(to.resolve(exporter.sysdir() + "-build")).toString() + "/Sources/**.metal").replaceAll('\\', '/'));
				out += "project.addFiles(";
				out += "'" + files[0] + "'";
				for (var i = 1; i < files.length; ++i) {
					out += ", '" + files[i] + "'";
				}
				out += ");\n";
				out += "project.addExcludes('Kha/Backends/Kore/khacpp/project/thirdparty/pcre-7.8/dftables.c', " 
				+ "'Kha/Backends/Kore/khacpp/project/thirdparty/pcre-7.8/pcredemo.c', " 
				+ "'Kha/Backends/Kore/khacpp/project/thirdparty/pcre-7.8/pcregrep.c', " 
				+ "'Kha/Backends/Kore/khacpp/project/thirdparty/pcre-7.8/pcretest.c', " 
				+ "'Kha/Backends/Kore/khacpp/src/ExampleMain.cpp', " 
				+ "'Kha/Backends/Kore/khacpp/src/hx/Scriptable.cpp', " 
				+ "'Kha/Backends/Kore/khacpp/src/hx/cppia/**', " 
				+ "'**/src/__main__.cpp', " 
				+ "'Kha/Backends/Kore/khacpp/src/hx/NekoAPI.cpp');\n";
				out += "project.addIncludeDirs('Kha/Backends/Kore/khacpp/include', '" + from.relativize(to.resolve(exporter.sysdir() + "-build")).toString().replaceAll('\\', '/') + "/Sources/include', " 
				+ "'Kha/Backends/Kore/khacpp/project/thirdparty/pcre-7.8', 'Kha/Backends/Kore/khacpp/project/libs/nekoapi');\n";
				
				if (options.vrApi == "rift") {
          out += "project.addIncludeDirs('C:/khaviar/LibOVRKernel/Src/');\n";
          out += "project.addIncludeDirs('C:/khaviar/LibOVR/Include/');\n";
				}
				
				
				
				out += "project.setDebugDir('" + from.relativize(to.resolve(exporter.sysdir())).toString().replaceAll('\\', '/') + "');\n";
				if (platform == Platform.Windows) out += "project.addDefine('HX_WINDOWS');\n";
				if (platform == Platform.WindowsApp) out += "project.addDefine('HX_WINDOWS'); project.addDefine('HX_WINRT');\n";
				if (platform == Platform.OSX) {
					out += "project.addDefine('HXCPP_M64');\n";
					out += "project.addDefine('HX_MACOS');\n";
				}
				if (platform == Platform.Linux) out += "project.addDefine('HX_LINUX');\n";
				if (platform == Platform.iOS) out += "project.addDefine('IPHONE');\nproject.addDefine('HX_IPHONE');\n";
				if (platform == Platform.Android) out += "project.addDefine('ANDROID');\nproject.addDefine('_ANDROID');\nproject.addDefine('HX_ANDROID');\n";
				if (platform == Platform.OSX) out += "project.addDefine('KORE_DEBUGDIR=\"osx\"');\n";
				if (platform == Platform.iOS) out += "project.addDefine('KORE_DEBUGDIR=\"ios\"');\n";
				//out << "project:addDefine(\"HXCPP_SCRIPTABLE\")\n";
				out += "project.addDefine('HXCPP_API_LEVEL=321');\n";
				out += "project.addDefine('STATIC_LINK');\n";
				out += "project.addDefine('PCRE_STATIC');\n";
				out += "project.addDefine('HXCPP_SET_PROP');\n";
				out += "project.addDefine('HXCPP_VISIT_ALLOCS');\n";
				out += "project.addDefine('KORE');\n";
				out += "project.addDefine('ROTATE90');\n";
				console.log("VrApi (main.js): " + Options.VrApi);
				if (Options.vrApi === "gearvr") {
          out += "project.addDefine('VR_GEAR_VR');\n";
				} else if (Options.vrApi === "cardboard") {
          out += "project.addDefine('VR_CARDBOARD');\n";
				} else if (Options.vrApi === "rift") {
          out += "project.addDefine('VR_RIFT');\n";
				}
				
				if (options.vrApi == "rift") {
          out += "project.addLib('C:/khaviar/LibOVRKernel/Lib/Windows/Win32/Release/VS2013/LibOVRKernel');\n";
          out += "project.addLib('C:/khaviar/LibOVR/Lib/Windows/Win32/Release/VS2013/LibOVR');\n";
				}
				
				if (platform === Platform.Windows || platform === Platform.WindowsApp) {
					out += "project.addDefine('_WINSOCK_DEPRECATED_NO_WARNINGS');\n";
				}
				if (platform === Platform.Windows) {
					out += "project.addLib('ws2_32');\n";
				}
				
				
				out += "project.addSubProject(Solution.createProject('Kha/Kore'));\n";
				out += "solution.addProject(project);\n";
				
				
				

				out += "if (fs.existsSync('Libraries')) {\n"
				out += "\tvar libraries = fs.readdirSync('Libraries');\n";
				out += "\tfor (var l in libraries) {\n";
				out += "\t\tvar lib = libraries[l];\n";
				out += "\t\tif (fs.existsSync(path.join('Libraries', lib, 'korefile.js'))) {\n";
				out += "\t\t\tproject.addSubProject(Solution.createProject('Libraries/' + lib));\n";
				out += "\t\t}\n";
				out += "\t}\n";
				out += "}\n";

				out += 'return solution;\n';
				fs.writeFileSync(from.resolve("korefile.js").toString(), out);
			}
			
			//exportKoreProject(directory);
			
			var kake = from.resolve(Paths.get("Kha", "Kore", "Tools", "kake", "kake" + exec.sys()));
			
			var gfx = "unknown";
			switch (Options.graphicsApi) {
				case GraphicsApi.OpenGL:
					gfx = "opengl";
					break;
				case GraphicsApi.OpenGL2:
					gfx = "opengl2";
					break;
				case GraphicsApi.Direct3D9:
					gfx = "direct3d9";
					break;
				case GraphicsApi.Direct3D11:
					gfx = "direct3d11";
					break;
				case GraphicsApi.Metal:
					gfx = "metal";
					break;
			}
			
			var vs = "unknown";
			switch (Options.visualStudioVersion) {
				case VisualStudioVersion.VS2010:
					vs = "vs2010";
					break;
				case VisualStudioVersion.VS2012:
					vs = "vs2012";
					break;
				case VisualStudioVersion.VS2013:
					vs = "vs2013";
					break;
			}
			
			{
				var exe = kake.toString();
				var opts = [];
				opts.push(platform);
				//+ " pch=" + Options::getPrecompiledHeaders()
				if (Options.intermediateDrive !== "") opts.push("intermediate=" + Options.intermediateDrive);
				opts.push("gfx=" + gfx);
				opts.push("vs=" + vs);
				if (from.toString() != ".") opts.push("from=" + from.toString());
				opts.push("to=" + to.resolve(Paths.get(exporter.sysdir() + "-build")).toString());
				require(korepath + 'main.js').run(
				{
					from: from,
					to: to.resolve(Paths.get(exporter.sysdir() + "-build")).toString(),
					platform: platform,
					graphicsApi: Options.graphicsApi,
					vrApi: Options.vrApi,
					visualStudioVersion: Options.visualStudioVersion,
					compile: options.compile,
					run: options.run
				},
				{
					info: log.info,
					error: log.error
				},
				function () {
					log.info('Done.');
					callback(name);
				});
			}
		}
		else {
			log.info('Done.');
			callback(name);
		}
	});
}

function exportKhaProject(from, to, platform, khaDirectory, haxeDirectory, oggEncoder, aacEncoder, mp3Encoder, h264Encoder, webmEncoder, wmvEncoder, theoraEncoder, kfx, krafix, khafolders, embedflashassets, options, callback) {
	log.info('Generating Kha project.');
	
	Files.createDirectories(to);
	var temp = to.resolve('temp');
	Files.createDirectories(temp);
	
	var exporter = null;
	var kore = false;
	switch (platform) {
		case Platform.Flash:
			exporter = new FlashExporter(khaDirectory, to, embedflashassets);
			break;
		case Platform.HTML5:
			exporter = new Html5Exporter(khaDirectory, to);
			break;
		case Platform.HTML5Worker:
			exporter = new Html5WorkerExporter(khaDirectory, to);
			break;
		case Platform.WPF:
			exporter = new WpfExporter(khaDirectory, to);
			break;
		case Platform.XNA:
			exporter = new XnaExporter(khaDirectory, to);
			break;
		case Platform.Java:
			exporter = new JavaExporter(khaDirectory, to);
			break;
		case Platform.PlayStationMobile:
			exporter = new PlayStationMobileExporter(khaDirectory, to);
			break;
		case Platform.Dalvik:
			exporter = new DalvikExporter(khaDirectory, to);
			break;
		default:
			kore = true;
			exporter = new KoreExporter(platform, khaDirectory, Options.vrApi, to);
			break;
	}

	Files.createDirectories(to.resolve(exporter.sysdir()));
	
	var name = '';
	var sources = [];
	var project = {
		format: 1,
		game: {
			name: "Unknown",
			width: 640,
			height: 480
		},
		assets: [],
		rooms: []
	};

	var foundProjectFile = false;
	if (name === '') name = from.toAbsolutePath().getFileName();
	project.game.name = name;
	
	if (Files.exists(from.resolve('project.kha'))) {
		project = JSON.parse(fs.readFileSync(from.resolve('project.kha').toString(), { encoding: 'utf8' }));
		foundProjectFile = true;
	}
	var libraries = [];
	if (Files.isDirectory(from.resolve('Libraries'))) {
		var dirs = Files.newDirectoryStream(from.resolve('Libraries'));
		for (var d in dirs) {
			var dir = dirs[d];
			if (Files.isDirectory(from.resolve(Paths.get('Libraries', dir)))) {
				var lib = {
					directory: 'Libraries/' + dir,
					project: {
						assets: [],
						rooms: []
					}
				};
				if (Files.exists(from.resolve(Paths.get('Libraries', dir, 'project.kha')))) {
					lib.project = JSON.parse(fs.readFileSync(from.resolve('Libraries', dir, 'project.kha').toString(), { encoding: 'utf8' }));
				}
				libraries.push(lib);
			}
		}
	}

	name = project.game.name;
	exporter.setWidthAndHeight(project.game.width, project.game.height);

	if (project.sources !== undefined) {
		for (var i = 0; i < project.sources.length; ++i) {
			sources.push(project.sources[i]);
		}
	}
	for (var l in libraries) {
		var lib = libraries[l];

		for (var a in lib.project.assets) {
			var asset = lib.project.assets[a];
			asset.libdir = lib.directory;
			project.assets.push(asset);
		}
		for (var r in lib.project.rooms) {
			var room = lib.project.rooms[r];
			project.rooms.push(room);
		}

		if (Files.isDirectory(from.resolve(Paths.get(lib.directory, 'Sources')))) {
			sources.push(lib.directory + '/Sources');
		}
		if (lib.project.sources !== undefined) {
			for (var i = 0; i < project.sources.length; ++i) {
				sources.push(lib.directory + '/' + project.sources[i]);
			}
		}
	}

	var encoders = {
		oggEncoder: oggEncoder,
		aacEncoder: aacEncoder,
		mp3Encoder: mp3Encoder,
		h264Encoder: h264Encoder,
		webmEncoder: webmEncoder,
		wmvEncoder: wmvEncoder,
		theoraEncoder: theoraEncoder
	};
	exportAssets(project.assets, 0, exporter, from, khafolders, platform, encoders, function () {
		project.shaders = [];
		addShaders(exporter, platform, project, to.resolve(exporter.sysdir()), temp, from.resolve(Paths.get('Sources', 'Shaders')), kfx, kfx);
		addShaders(exporter, platform, project, to.resolve(exporter.sysdir()), temp, from.resolve(Paths.get('Kha', 'Sources', 'Shaders')), krafix, kfx);
		for (var i = 0; i < sources.length; ++i) {
			addShaders(exporter, platform, project, to.resolve(exporter.sysdir()), temp, from.resolve(sources[i]).resolve('Shaders'), kfx, kfx);
			exporter.addSourceDirectory(sources[i]);
		}
		
		if (foundProjectFile) {	
			fs.writeFileSync(temp.resolve('project.kha').toString(), JSON.stringify(project, null, '\t'), { encoding: 'utf8' });
			exporter.copyBlob(platform, temp.resolve('project.kha'), Paths.get('project.kha'), function () {
				log.info('Assets done.');
				exportProjectFiles(name, from, to, options, exporter, platform, khaDirectory, haxeDirectory, kore, callback);
			});
		}
		else {
			exportProjectFiles(name, from, to, options, exporter, platform, khaDirectory, haxeDirectory, kore, callback);
		}
	});
}

function isKhaProject(directory) {
	return Files.exists(directory.resolve('Kha')) || Files.exists(directory.resolve('project.kha'));
}

function exportProject(from, to, platform, khaDirectory, haxeDirectory, oggEncoder, aacEncoder, mp3Encoder, h264Encoder, webmEncoder, wmvEncoder, theoraEncoder, kfx, krafix, khafolders, embedflashassets, options, callback) {
	if (isKhaProject(from)) {
		exportKhaProject(from, to, platform, khaDirectory, haxeDirectory, oggEncoder, aacEncoder, mp3Encoder, h264Encoder, webmEncoder, wmvEncoder, theoraEncoder, kfx, krafix, khafolders, embedflashassets, options, callback);
	}
	else {
		log.error('Neither Kha directory nor project.kha found.');
		callback('Unknown');
	}
}

exports.api = 1;

exports.run = function (options, loglog, callback) {
	log.set(loglog);

	var done = function (name) {
		if (options.platform === Platform.Linux && options.run) {
			log.info('Running...');
			var run = child_process.spawn(
				pathlib.join(process.cwd(), options.to, 'linux-build', name),
				[],
				{ cwd: pathlib.join(process.cwd(), options.to, 'linux') });

			run.stdout.on('data', function (data) {
				log.info(data.toString());
			});

			run.stderr.on('data', function (data) {
				log.error(data.toString());
			});

			run.on('close', function (code) {
				callback(name);
			});
		}
		else callback(name);
	};

	if (options.kha === undefined || options.kha === '') {
		var path = Paths.get(options.from).resolve(Paths.get('Kha'));
		if (Files.isDirectory(path)) options.kha = path.toString();
	}

	if (options.haxe === '') {
		var path = Paths.get(options.kha, 'Tools', 'haxe');
		if (Files.isDirectory(path)) options.haxe = path.toString();
	}
	
	if (options.kfx === '') {
		var path = Paths.get(options.kha, "Kore", "Tools", "kfx", "kfx" + exec.sys());
		if (Files.exists(path)) options.kfx = path.toString();
	}

	if (options.krafix === '' || options.krafix === undefined) {
		var path = Paths.get(options.kha, "Kore", "Tools", "krafix", "krafix" + exec.sys());
		if (Files.exists(path)) options.krafix = path.toString();
	}
	
	if (options.ogg === '') {
		var path = Paths.get(options.kha, "Tools", "oggenc", "oggenc" + exec.sys());
		if (Files.exists(path)) options.ogg = path.toString() + ' {in} -o {out}';
	}
	
	if (options.graphicsApi !== undefined) {
		Options.graphicsApi = options.graphicsApi;
	}
	
	if (options.vrApi != undefined) {
    Options.vrApi = options.vrApi;
    log.info("Vr API is: " + Options.vrApi);
	}
	
	if (options.visualStudioVersion !== undefined) {
		Options.visualStudioVersion = options.visualStudioVersion;	
	}

	exportProject(Paths.get(options.from), Paths.get(options.to), options.platform, Paths.get(options.kha), Paths.get(options.haxe), options.ogg, options.aac, options.mp3, options.h264, options.webm, options.wmv, options.theora, options.kfx, options.krafix, options.khafolders, options.embedflashassets, options, done);
};
