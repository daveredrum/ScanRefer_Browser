import React from 'react';
import ReactDOM from 'react-dom';
import RootUI from './view/RootUI';
import ViewUI from "./view/ViewUI";
import WindowManager from "../Common/WindowManager"
import ControlContent from './view/ControlContent'
import InfoContent from './view/InfoContent'
import Stats from "../../lib/utils/stats.min.js";
import * as utils from "../Common/utils";
import * as nyuv2 from "../Common/NYUv2_colors";
import * as THREE from 'three/build/three';
import * as path from "path";
import { POINT_CONVERSION_COMPRESSED } from 'constants';

window.THREE = THREE;

class MeshViewer {

	init(params) {
		this.draw_div();

		// setup resources
		this.get_resource(params);

		// setup container
		this.label_container = document.getElementById("label_container");

		// setup button
		this.btn = new Object();
		this.btn.none = document.getElementById("btn_none");
		this.btn.surface = document.getElementById("btn_surface");
		this.btn.info = document.getElementById("info_helper");
		this.btn.close_info = document.getElementById("close_info");
		this.info = document.getElementById("info_container");
		this.btn.control = document.getElementById("control_helper");
		this.btn.close_control = document.getElementById("close_control");
		this.control = document.getElementById("control_container");
		// this.btn.instance = document.getElementById("btn_instance");
		this.add_listener(this.btn.none, "click", this.on_click_btn_none);
		this.add_listener(this.btn.surface, "click", this.on_click_btn_surface);
		// his.add_listener(this.btn.instance, "click", this.on_click_btn_instance);
		// this.add_listener(this.btn.info, "click", this.on_click_btn_info);
		// this.add_listener(this.btn.close_info, "click", this.on_click_close_info);
		this.add_listener(this.btn.control, "click", this.on_click_btn_control);
		this.add_listener(this.btn.close_control, "click", this.on_click_close_control);
		this.add_listener(document, "keydown", this.on_keydown_keyc);
		this.add_listener(document, "click", this.on_dismiss_popover);

		// setup window mesh
		this.window_mesh = new WindowManager("canvas_container", "canvas");
		this.window_mesh.init();
		this.attach_listener();

		// setup scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0xffffff );

		// renderer
		this.context = this.window_mesh.canvas.getContext("webgl2");
		this.renderer = new THREE.WebGLRenderer( { canvas: this.window_mesh.canvas, context: this.context } );
		this.renderer.setSize( this.window_mesh.window_width, this.window_mesh.window_height );

		// raycaster
		this.raycaster = new THREE.Raycaster();
		this.intersected = null;

		// loading bar
		this.loading_bar = document.getElementById("loading_bar");
		this.loading_bar.style.width = "10%";

		// primary promises for loading meshes
		let promises = [
			window.load_ply_file(path.join("/apps/resource/mesh/", this.resources.scene_id, this.resources.scene_mesh)),
			window.load_ply_file("/apps/resource/camera")
		];
		for (let i = 0; i < this.resources.scene_object.length; i++) {
			promises.push(
				window.load_ply_file(path.join("/apps/resource/object/", this.resources.scene_id, this.resources.scene_object[i]))
			)
		}
		this.loading_bar.style.width = "15%";
		Promise.all(promises).then(values => {
			// unpack data 
			this.scene_geometry = values[0];
			this.scene_geometry.computeVertexNormals();
			this.scene_geometry.computeBoundingSphere();
			this.scene_geometry_center = this.get_object_center(this.scene_geometry);
			this.camera_geometry = values[1];
			this.camera_geometry.computeVertexNormals();
			this.object_geometry = new Array();
			for (let i = 0; i < this.resources.scene_object.length; i++) {
				this.object_geometry.push(values[i+2]);
				this.object_geometry[i].name = this.resources.scene_object_id[i]+"_"+this.resources.scene_object_name[i];
				this.object_geometry[i].computeVertexNormals();
			}
			this.loading_bar.style.width = "35%";
			// console.log(this.geometry);

			let new_promises = [
				window.xhr_json("GET", path.join("/apps/resource/pose/", this.resources.scene_id)),
				window.xhr_json("GET", path.join("/apps/resource/gallery/", this.resources.scene_id))
			];
			// for (let i = 0; i < this.indices.length; i++) {
			// 	new_promises.push(window.load_matrix(path.join("/apps/resource/pose/", this.resources.scene_id, this.indices[i] + ".txt")));
			// }
			this.loading_bar.style.width = "45%";
			Promise.all(new_promises).then(new_values => {
				// unpack data
				this.poses = this.parse_pose(new_values[0]);
				this.object_gallery = new_values[1];
				// randomly pick every 10 frames
				this.interval = 10;
				this.indices = this.get_frame_indices();
				this.loading_bar.style.width = "55%";

				// Lights
				this.add_mesh(this.scene, [new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6)]);
				this.add_mesh(this.scene, [this.window_mesh.camera]);
				this.add_mesh(this.window_mesh.camera, [new THREE.PointLight(0xffffff, 0.5)]);
				this.loading_bar.style.width = "65%";

				// setup scene background mesh
				this.scene_mesh = this.set_mesh(
					this.scene_geometry,
					new THREE.MeshStandardMaterial({vertexColors: THREE.VertexColors, metalness: 0.0})
				);
				this.add_mesh(this.scene, [this.scene_mesh]);
				this.loading_bar.style.width = "85%";
				
				// indexing the mesh view
				// {0: none, 1: surface, 2: instance}
				this.mesh_view = 1;
				this.instance_id = -1;
				this.selected_id = "-1";
				this.annotation_info = new Object();

				// setup the vitual camera
				this.camera_flag = false;

				// setup object meshs
				this.object_mesh = new Array();
				this.object_dict = new Object();
				this.object_hexs = new Object();
				for (let i = 0; i < this.object_geometry.length; i++) {
					this.object_mesh.push(this.set_mesh(
						this.object_geometry[i],
						new THREE.MeshStandardMaterial({vertexColors: THREE.VertexColors, metalness: 0.0})
					));
					this.object_mesh[i].name = this.resources.scene_object_id[i]+"_"+this.resources.scene_object_name[i];
					this.object_dict[this.resources.scene_object_id[i]] = this.object_mesh[i];
					this.object_hexs[this.resources.scene_object_id[i]] = this.object_mesh[i].material.emissive.getHex();
				}
				this.add_mesh(this.scene, this.object_mesh);
				// this.add_mesh(this.scene, [this.object_mesh[0]]);
				this.loading_bar.style.width = "100%";

				// // axis
				// this.axis = new THREE.AxisHelper();
				// this.scene.add(this.axis);

				document.getElementById("loading_container").style.display = "none";
				// document.getElementById("image_container").style.display = "block";
				document.getElementById("button_container").style.display = "block";

				// render instance list
				this.render_label_list();
				this.render_label_color(false);
				this.add_label_listener();

				// HACK
				this.insert_center()

				// start rendering
				console.log(this.scene);
				console.log(this.scene_geometry_center);
				this.create_stats();
				this.init_camera()
				this.render_annotation_results();
				// this.preload_frame();
				this.render();
			});
		});

	}

	init_camera() {
		let radius = this.scene_geometry.boundingSphere.radius + 2;
		let init_pos = new THREE.Vector3(0, -radius, radius);
		let lookat = new THREE.Vector3(0, 0, 0);
		let up = new THREE.Vector3(0, 0, 1);
		this.window_mesh.set_view(init_pos, up, lookat);
	}

	init_object_hex() {
		// init color
		for (let i = 0; i < this.object_mesh.length; i++) {
			this.object_mesh[i].material.emissive.setHex(this.object_hexs[this.resources.scene_object_id[i]]);
		}
	}

	/********************************************
     *************     renderers    *************
     ********************************************/	

	render() {
		this.stats.begin();
		// set current camera
		// this.add_mesh(this.window_mesh.camera, [this.camera_light]);
		// let closest_pose = this.get_closest_pose();
		// let nav_vector = new THREE.Vector3();
		// this.window_mesh.camera.getWorldDirection(nav_vector);
		// highlight the intersected object
		this.get_intersection();
		// render
		// if (this.preload_complete) this.render_frame(closest_pose);
		this.renderer.render( this.scene, this.window_mesh.camera );
		this.window_mesh.advance(0, 8);
		this.stats.end();
		
		

		requestAnimationFrame(this.render.bind(this));
	}

	render_frame(pose) {
		// show frame
		// let index = pose.index;
		// let img_url = path.join("/apps/resource/frame/", this.resources.scene_id, pose.index + ".jpg");
		// document.getElementById("image").src = img_url;
		try {
			document.getElementById("image").src = this.resources.preload_frames[this.selected_id][pose.index].src;
		}
		catch (err) {
			console.log("invalid frame")
		}
		// // show vitual camera
		// if (this.camera_flag) {
		// 	// this.scene.remove(this.camera_mesh);
		// 	this.remove_mesh(this.scene, [this.camera_mesh]);
		// }
		
		// this.camera_mesh = new THREE.Mesh(this.camera_geometry, new THREE.MeshStandardMaterial( { color: 0x666666 } ));
		// this.camera_mesh.applyMatrix(pose.pose);
		// this.camera_mesh.scale.set(0.4, 0.4, 0.4);
		// this.camera_mesh.position.x -= this.scene_geometry_center.x;
		// this.camera_mesh.position.y -= this.scene_geometry_center.y;
		// this.camera_mesh.position.z -= this.scene_geometry_center.z;
		// // this.scene.add(this.camera_mesh);
		// this.add_mesh(this.scene, [this.camera_mesh]);
		// this.camera_flag = true;
	}

	render_annotation_results() {
		window.xhr_json("GET", path.join("/apps/database/mesh2cap/query", this.resources.scene_id, this.selected_id, "-1")).then(results => {
			let bg_palette = {
				0: "#ebf8ff",
				1: "#cce5f1"
			};
			let data = results.data;
			let view_ui = document.getElementById("ViewUI");
			if (view_ui.hasChildNodes()) while (view_ui.firstChild) view_ui.removeChild(view_ui.firstChild);
			if (data.length > 0) {
				for (let i = 0; i < data.length; i++) {
					let view_container = document.createElement("tr");
					view_container.style.width = "100%";
					view_ui.appendChild(view_container);
					ReactDOM.render(<ViewUI bg={bg_palette[i%2]} object_id={data[i].object_id} anno_id={data[i].anno_id} ann_worker_id={data[i].annotate.worker_id} ver_worker_id={data[i].verify.worker_id} status={data[i].status} description={data[i].description}/>, view_container, function() {
						this.btn["view_"+data[i].object_id+"_"+data[i].anno_id] = document.getElementById("view_"+data[i].object_id+"_"+data[i].anno_id);
						this.btn["scene_"+data[i].object_id+"_"+data[i].anno_id] = document.getElementById("scene_"+data[i].object_id+"_"+data[i].anno_id);
						this.add_listener(this.btn["view_"+data[i].object_id+"_"+data[i].anno_id], "click", this.on_click_operation, "view_"+data[i].object_id+"_"+data[i].anno_id);
						this.add_listener(this.btn["scene_"+data[i].object_id+"_"+data[i].anno_id], "click", this.on_click_operation, "scene_"+data[i].object_id+"_"+data[i].anno_id);
						
						// this.btn["comment_"+data[i].object_id+"_"+data[i].anno_id] = document.getElementById("comment_"+data[i].object_id+"_"+data[i].anno_id);
						// if (data[i].verify.comment || data[i].verify.reworded) {
						// 	// this.visible_popover = new Object();
						// 	// $("comment_"+data[i].object_id+"_"+data[i].anno_id).popover({trigger: "focus"})
						// 	this.add_listener(this.btn["comment_"+data[i].object_id+"_"+data[i].anno_id], "click", this.on_click_comment, "comment_"+data[i].object_id+"_"+data[i].anno_id+"_"+data[i].verify.comment+"|"+data[i].verify.reworded);

						// }
						// else {
						// 	// this.btn["comment_"+data[i].object_id+"_"+data[i].anno_id].disabled = true;
						// 	let class_ = this.btn["comment_"+data[i].object_id+"_"+data[i].anno_id].getAttribute("class");
						// 	this.btn["comment_"+data[i].object_id+"_"+data[i].anno_id].setAttribute("class", class_+" disabled")
						// }
						// $(".popover-dismiss").popover({trigger: 'focus'});
					}.bind(this));	
				}
			}
		});
	}

	render_canvas_label(x, y) {
		if (document.getElementById("canvas_label_div")) document.getElementById("id_div_root").removeChild(this.canvas_label);

		this.canvas_label = document.createElement("div");
		this.canvas_label.id = "canvas_label_div";
		this.canvas_label.style.position = "absolute";
		this.canvas_label.style.left = x + "px";
		this.canvas_label.style.top = y + "px";
		this.canvas_label.style.backgroundColor = "white";
		this.canvas_label.innerHTML = this.intersected_name;
		document.getElementById("id_div_root").appendChild(this.canvas_label);
	}

	render_label_list() {
		// add instances
		for (let object_id = 0; object_id < this.resources.scene_object_name.length; object_id++) {
			utils.add_instance_label(document, this.label_container, this.resources.palette, this.resources.scene_object_name[object_id], this.resources.scene_object_id[object_id], this.resources.scene_object_id[object_id]);
		}
	}

	render_label_color(visible) {
		let labels = document.getElementById("label_container").childNodes;
		for (let label_id = 0; label_id < labels.length; label_id++) {
			let cur_id = labels[label_id].id;
			let cur_label = document.getElementById(cur_id);
			let cur_color_div = document.getElementById(cur_label.childNodes[0].id);
			let object_id = cur_color_div.id.split("_").slice(-1)[0]
			let cur_color_idx = document.getElementById("color_idx_"+object_id);
			this.annotation_info[object_id] = {
				major_color: "rgb(200, 200, 200)",
				num_anno: "0"
			}
			window.xhr_json("GET", path.join("/apps/database/mesh2cap/query", this.resources.scene_id, object_id, "-1")).then(results => {
				this.render_label_color_div(cur_color_div, cur_color_idx, results, object_id);
			});
		}
	}

	render_label_color_div(color_div, color_idx, record, object_id) {
		let info = this.get_annotation_info(record);
		color_div.style.backgroundColor = info.major_color;
		color_idx.innerHTML = info.num_anno;
		this.annotation_info[object_id].major_color = info.major_color;
		this.annotation_info[object_id].num_anno = info.num_anno;
	}

	render_mesh_none() {
		this.scene_mesh.material = new THREE.MeshStandardMaterial( { color: 0xbcbcbc, metalness: 0.0 } );
		for (let i = 0; i < this.object_mesh.length; i++) {
			this.object_mesh[i].material = new THREE.MeshStandardMaterial( { color: 0xbcbcbc, metalness: 0.0 } );
		}
	}

	render_mesh_surface() {
		this.scene_mesh.material = new THREE.MeshStandardMaterial( { vertexColors: THREE.VertexColors, metalness: 0.0 } );
		for (let i = 0; i < this.object_mesh.length; i++) {
			this.object_mesh[i].material = new THREE.MeshStandardMaterial( { vertexColors: THREE.VertexColors, metalness: 0.0 } );
		}
	}

	render_mesh_annotated() {
		this.scene_mesh.material = new THREE.MeshStandardMaterial( { color: 0xbcbcbc, metalness: 0.0, transparent: true, opacity: 0.1 } );
		let annotation_info_keys = Object.keys(this.annotation_info);
		for (let i = 0; i < this.object_mesh.length; i++) {
			this.object_mesh[i].material = new THREE.MeshStandardMaterial( { color: this.annotation_info[annotation_info_keys[i]].major_color, metalness: 0.0 } );
		}
	}

	/********************************************
     *************       Utils      *************
     ********************************************/

	get_resource(params) {
		this.resources = new Object();
		this.resources.username = params.username;
		this.resources.root = params.scannet;
		this.resources.scene_id = params.scene_id;
		this.resources.scene_object = params.scene_object;
		this.resources.scene_object_id = this.get_scene_object_id();
		this.resources.scene_object_name = this.get_scene_object_name();
		this.resources.scene_object_dict = this.get_scene_object_dict();
		this.resources.scene_frame = params.scene_frame;
		this.resources.scene_mesh = this.resources.scene_id + "_vh_clean_2.ply";
		// this.resources.scene_mesh = this.resources.scene_id + "_vh_clean.ply";
		// this.resources.instance_aggr = this.resources.scene_id + ".aggregation.json";
		this.resources.frames = "color";
		this.resources.poses = "pose";
		this.resources.palette = this.get_instance_palette();
		// console.log(this.resources.scene_object);
	}

	get_scene_object_id() {
		let scene_object_id = new Array();
		for (let i = 0; i < this.resources.scene_object.length; i++) {
			scene_object_id.push(this.resources.scene_object[i].split(".")[0].split("_")[0])
		}

		return scene_object_id;
	}

	get_scene_object_name() {
		let scene_object_name = new Array();
		for (let i = 0; i < this.resources.scene_object.length; i++) {
			scene_object_name.push(this.resources.scene_object[i].split(".")[0].split("_").slice(1).join(" "))
		}

		return scene_object_name;
	}

	get_scene_object_dict() {
		let scene_object_dict = new Object();
		for (let i = 0; i < this.resources.scene_object_id.length; i++) {
			scene_object_dict[this.resources.scene_object_id[i]] = this.resources.scene_object_name[i];
		}

		return scene_object_dict;
	}

	get_instance_palette() {
		let palette = nyuv2.create_palette();
		let instance_palette = new Array();
		for (let i = 0; i < this.resources.scene_object.length; i++) {
			instance_palette.push(palette[i%palette.length]);
		}

		return instance_palette;
	}

	get_frame_indices() {
		// let new_indices = [];
		// let cur_index = 0;
		// while (true) {
		// 	if (cur_index >= this.resources.scene_frame.length) {
		// 		break;
		// 	}
		// 	else {
		// 		new_indices.push(parseInt(this.resources.scene_frame[cur_index]));
		// 		cur_index += this.interval;
		// 	}
		// }

		let new_indices = new Object();
		let max_len = 200;
		new_indices["-1"] = new Array();
		this.num_frames = 0
		for (let i = 0; i < this.resources.scene_object_id.length; i++) {
			let indices = this.object_gallery[parseInt(this.resources.scene_object_id[i])].slice(0, max_len);
			new_indices[this.resources.scene_object_id[i]] = indices
			new_indices["-1"].push(...indices.slice(0, 10));
			this.num_frames += indices.length;
			this.num_frames += indices.slice(0, 10).length;
		}

		return new_indices;
	}

	get_closest_pose() {
		// decode the current camera rotation vector	
		let cur_rotation_vector = new THREE.Vector3();
		this.window_mesh.camera.getWorldDirection(cur_rotation_vector);
		// get the closest camera pose
		let closest_pose = new Object();
		closest_pose.index = 0;
		closest_pose.angle = Infinity;
		closest_pose.pose = this.poses[0];
		for (let i = 0; i < this.indices[this.selected_id].length; i++) {
			try {
				// decode the frame camera rotation vector
				let pose_rotation = new THREE.Matrix4()
				pose_rotation.extractRotation(this.poses[this.indices[this.selected_id][i]])
				let pose_rotation_vector = (new THREE.Vector3(0, 0, 1)).applyMatrix4(pose_rotation)
				let rotation_angle = (pose_rotation_vector).angleTo(cur_rotation_vector);

				if (rotation_angle < closest_pose.angle) {
					closest_pose.angle = rotation_angle;
					closest_pose.index = this.indices[this.selected_id][i];
					closest_pose.pose = this.poses[this.indices[this.selected_id][i]];
				}
			}
			catch(err) {}
		}
		return closest_pose;
	}

	get_object_center(geometry) {
		return geometry.boundingSphere.center;
	}

	get_annotation_info(record) {
		let status_count = {
			unverified: 0,
			verified: 0
		}
		let status_palette = {
			unverified: "rgb(240, 173, 78)",
			verified: "rgb(92, 193, 61)",
		}
		let annotation_info = {
			major_color: "rgb(200, 200, 200)",
			num_anno: "0"
		} 
		if (record.data.length > 0) {
			for (let i = 0; i < record.data.length; i++) {
				status_count[record.data[i].status]++;
			}
			let major_status = Object.keys(status_count).reduce((a, b) => status_count[a] > status_count[b] ? a : b);
			let total_anno = Object.values(status_count).reduce((a, b) => a + b);
			annotation_info.major_color = status_palette[major_status];
			annotation_info.num_anno = total_anno.toString();
		}

		return annotation_info
	}

	get_intersection() {
		if (this.window_mesh.is_mouse_in_model_panel()) {
			this.raycaster.setFromCamera(this.window_mesh.pos_mouse, this.window_mesh.camera);
			let intersected = this.raycaster.intersectObjects(this.scene.children.slice(3));
			let ignore_list = [0x218838, 0xff0000, 0xffc107]
			if (intersected.length > 0) {
				if (!(ignore_list.includes(intersected[0].object.material.emissive.getHex()))) {
					if (this.intersected) this.intersected.material.emissive.setHex(this.intersected.currentHex);
					this.intersected = intersected[0].object;
					this.intersected.currentHex = this.intersected.material.emissive.getHex();
					this.intersected.material.emissive.setHex(0x0059ff);
					this.instance_id = parseInt(this.intersected.name.split("_")[0]);
					this.intersected_name = this.intersected.name;
				}
			} 
			else {
				if (this.intersected) this.intersected.material.emissive.setHex(this.intersected.currentHex);
				this.intersected = null;
				this.instance_id = -1;
			}
		}
	}

	set_preloading_progress(progress) {
		let frame_loading_bar = document.getElementById("frame_loading_bar");
		let frame_loading_progress = document.getElementById("frame_loading_progress");
		frame_loading_bar.style.width = progress + "%";
		frame_loading_progress.innerHTML = progress;
	}

	set_mesh(geometry, material) {
		let mesh = new THREE.Mesh(geometry, material);
		mesh.position.x = -this.scene_geometry_center.x;
		mesh.position.y = -this.scene_geometry_center.y;
		mesh.position.z = -this.scene_geometry_center.z;

		return mesh
	}

	add_mesh(container, mesh_list) {
		for (let i = 0; i < mesh_list.length; i++) {
			container.add(mesh_list[i]);
		}
	}

	remove_mesh(container, mesh_list) {
		for (let i = 0; i < mesh_list.length; i++) {
			container.remove(mesh_list[i]);
		}
	}

	parse_pose(pose_object) {
		let parsed = new Object();
		let pose_ids = Object.keys(pose_object);
		for (let i = 0; i < pose_ids.length; i++) {
			let pose_id = parseInt(pose_ids[i]);
			let pose = new THREE.Matrix4();
			pose.fromArray(pose_object[pose_ids[i]]);
			pose.transpose();
			parsed[pose_id] = pose
		}

		return parsed;
	}

	preload_frame() {
		this.resources.preload_frames = new Object();
		this.resources.num_preload = 0
		let indice_key = Object.keys(this.indices);
		for (let i = 0; i < indice_key.length; i++) {
			this.resources.preload_frames[indice_key[i]] = new Object();
			for (let j = 0; j < this.indices[indice_key[i]].length; j++) {
				let frame = new Image();
				frame.onload = function () {
					this.resources.preload_frames[indice_key[i]][this.indices[indice_key[i]][j]] = frame;
					this.resources.num_preload++;
					this.set_preloading_progress(Math.round(100 * this.resources.num_preload / this.num_frames));
					if (this.resources.num_preload == this.num_frames) {
						this.preload_complete = true;
						document.getElementById("frame_loading_container").style.display = "none";
						console.log("preloading complete")
					}
				}.bind(this);
				// frame.src = path.join("/apps/resource/frame/", this.resources.scene_id, this.indices[i] + ".jpg");
				frame.src = path.join("/apps/resource/frame/reduced", this.resources.scene_id, this.indices[indice_key[i]][j] + ".jpg");
			}
		}
	}

	insert_center() {
		window.xhr_json("GET", path.join("/apps/database/mesh2cap/query/", this.resources.scene_id, "-1", "-1")).then(results => {
			for (let i = 0; i < results.data.length; i++) {
				let record = results.data[i]
				if (!("center" in record.camera)) {
					record.camera.center = this.scene_geometry_center.toArray();
					window.xhr_post(JSON.stringify(record), "/apps/database/mesh2cap/save").then(() => {
						console.log("inserted scene center");
					});
				}
			}
		});
	}

	get_timestamp() {
		let stamp = new Date();
		let year = ""+stamp.getFullYear();
		let month = ""+(stamp.getMonth()+1);
		let date = ""+stamp.getDate();
		let hour = ""+stamp.getHours();
		let minute = ""+stamp.getMinutes();
		let second = ""+stamp.getSeconds();
	
		// format
		if (month.length < 2) month = "0" + month;
		if (date.length < 2) date = "0" + date;
		if (hour.length < 2) hour = "0" + hour;
		if (minute.length < 2) minute = "0" + minute;
		if (second.length < 2) second = "0" + second; 
	
		let date_str = year+'-'+month+'-'+date;
		let time_str = hour+":"+minute+":"+second;
		let date_time = date_str+'_'+time_str;
	
		return date_time;
	}

	set_focus(mode, object_id, anno_id) {
		// reset object hex
		this.init_object_hex();

		// query record
		window.xhr_json("GET", path.join("/apps/database/mesh2cap/query/", this.resources.scene_id, object_id, anno_id)).then(results => {
			try {
				let record = results.data[0];
				let target_id = record.object_id.toString();
				let selected_ids;
				if (mode == "view") {
					// set camera
					let matrixWorld = new THREE.Matrix4();
					matrixWorld.fromArray(record.camera.matrixWorld);
					let new_pos = new THREE.Vector3();
					new_pos.setFromMatrixPosition(matrixWorld);
					let new_lookat = new THREE.Vector3();
					new_lookat.fromArray(record.camera.lookat);
					let new_up = new THREE.Vector3(0, 0, 1);
					this.window_mesh.set_view(new_pos, new_up, new_lookat);

					console.log(new_pos);
					console.log(new_lookat);

					// verification info
					selected_ids = record.verify.selected_in_view.split(" ");
				}
				else {
					// set camera
					this.init_camera();

					// verification info
					selected_ids = record.verify.selected_in_scene.split(" ");
				}

				// set color
				this.object_dict[target_id].material.emissive.setHex(0x218838);

				// if (selected_ids.includes(target_id)) {
					// this.object_dict[target_id].material.emissive.setHex(0x218838);
					// for (let i = 0; i < selected_ids.length; i++) {
					// 	if(selected_ids[i] != target_id) this.object_dict[selected_ids[i]].material.emissive.setHex(0xffc107);
					// }
				// }
				// else {
					// this.object_dict[target_id].material.emissive.setHex(0xff0000);
					// for (let i = 0; i < selected_ids.length; i++) {
					// 	this.object_dict[selected_ids[i]].material.emissive.setHex(0xffc107);
					// }
				// }
				
			}
			catch (err) {
				console.log("no entry found in the database");
			}
		});
	}
	
	/********************************************
     *************  Event handlers  *************
     ********************************************/

	on_click_btn_none() {
		console.log("show the mesh geometry");
		this.render_mesh_none();
	}

	on_click_btn_surface() {
		console.log("show the mesh surface, current selected instance: "+this.selected_id);
		this.mesh_view = 1;
		this.render_mesh_surface();
	}

	on_click_btn_info() {
		ReactDOM.render(<InfoContent/>, document.getElementById("info_content"), function() {
			this.info.style.display = "block";
			this.info.scrollTop = 0;
		}.bind(this));
	}

	on_click_close_info() {
		this.info.style.display = "none";
	}

	on_click_btn_control() {
		ReactDOM.render(<ControlContent/>, document.getElementById("control_content"), function() {
			this.control.style.display = "block";
			this.control.scrollTop = 0;
		}.bind(this));
	}

	on_click_close_control() {
		this.control.style.display = "none";
	}

	on_dismiss_popover(event) {
		// $('[data-toggle="popover"]').each(function () {
		// 	//the 'is' for buttons that trigger popups
		// 	//the 'has' for icons within a button that triggers a popup
		// 	if (!$(this).is(event.target) && $(this).has(event.target).length === 0 && $('.popover').has(event.target).length === 0) {
		// 		(($(this).popover('hide').data('bs.popover')||{}).inState||{}).click = false  // fix for BS 3.3.6
		// 	}
		// });
	}

	on_click_comment(id) {
		return function() {
			// setting
			let operation = id.split("_")[0];
			let object_id = id.split("_")[1];
			let anno_id = id.split("_")[2];
			let misc = id.split("_")[3];
			let comment = misc.split("|")[0];
			let rephrase = misc.split("|")[1];
			$("#{0}_{1}_{2}".format(operation, object_id, anno_id)).popover({
				trigger: 'focus',
				placement: 'top',
				title: comment,
				content: rephrase
			});
			// if (this.visible_popover.shown) {
			// 	if (this.visible_popover.id == "{0}_{1}_{2}".format(operation, object_id, anno_id)) {
			// 		$("#{0}".format(this.visible_popover.id)).popover("hide");

			// 		this.visible_popover = new Object();
			// 	}
			// 	else {
			// 		$("#{0}".format(this.visible_popover.id)).popover("hide");
			// 		$("#{0}_{1}_{2}".format(operation, object_id, anno_id)).popover("show");
			// 		this.visible_popover = new Object();
			// 		this.visible_popover.shown = true;
			// 		this.visible_popover.id = "{0}_{1}_{2}".format(operation, object_id, anno_id)
			// 	}
				
			// }
			// else {
			// 	$("#{0}_{1}_{2}".format(operation, object_id, anno_id)).popover("show");
			// 	this.visible_popover.shown = true;
			// 	this.visible_popover.id = "{0}_{1}_{2}".format(operation, object_id, anno_id)
			// }

			// set description
			if (this.focused) {
				this.focused.description.style.fontWeight = "normal";
			}
			this.focused = new Object();
			this.focused.description = document.getElementById("description_"+object_id+"_"+anno_id);
			this.focused.description.style.fontWeight = "bold";

			// set view
			this.set_focus(operation, object_id, anno_id);
			
		}.bind(this);
	}

	on_click_operation(id) {
		return function() {
			// setting
			let operation = id.split("_")[0];
			let object_id = id.split("_")[1];
			let anno_id = id.split("_")[2];
			
			// set description
			if (this.focused) {
				this.focused.description.style.fontWeight = "normal";
			}
			this.focused = new Object();
			this.focused.description = document.getElementById("description_"+object_id+"_"+anno_id);
			this.focused.description.style.fontWeight = "bold";

			// set view
			this.set_focus(operation, object_id, anno_id);
		}.bind(this);
	}

	on_click_label(id) {
		return function() {			
			// remove the old mesh
			this.scene.remove(this.mesh);

			// parse instance id
			if (id == "label_ALL") {
				this.instance_id = -1;
				this.selected_id = "-1"
				this.init_camera();
				this.mesh_view = 1;
				this.render_mesh_surface();
			}
			else {
				this.init_object_hex();
				this.instance_id = id.split("_").slice(-1)[0];
				this.selected_id = id.split("_").slice(-1)[0];
				if (this.intersected) {
					this.intersected.material.emissive.setHex(this.intersected.currentHex);
				}
				this.intersected = this.object_dict[this.instance_id];
				this.intersected.currentHex = this.intersected.material.emissive.getHex();
				this.intersected.material.emissive.setHex(0x0059ff);

				// set focus
				window.xhr_json("GET", path.join("/apps/database/mesh2cap/query/", this.resources.scene_id, this.selected_id, "-1")).then(results => {
					try {
						let record = results.data[0];
						let target_id = record.object_id.toString();
						let selected_ids;

						// set camera
						let matrixWorld = new THREE.Matrix4();
						matrixWorld.fromArray(record.camera.matrixWorld);
						let new_pos = new THREE.Vector3();
						new_pos.setFromMatrixPosition(matrixWorld);
						let new_lookat = new THREE.Vector3();
						new_lookat.fromArray(record.camera.lookat);
						let new_up = new THREE.Vector3(0, 0, 1);
						this.window_mesh.set_view(new_pos, new_up, new_lookat);

						// verification info
						selected_ids = record.verify.selected_in_view.split(" ");

						// set color
						this.object_dict[target_id].material.emissive.setHex(0x218838);

						// if (selected_ids.includes(target_id)) {
						// 	this.object_dict[target_id].material.emissive.setHex(0x218838);
						// 	for (let i = 0; i < selected_ids.length; i++) {
						// 		if(selected_ids[i] != target_id) this.object_dict[selected_ids[i]].material.emissive.setHex(0xffc107);
						// 	}
						// }
						// else {
						// 	this.object_dict[target_id].material.emissive.setHex(0xff0000);
						// 	for (let i = 0; i < selected_ids.length; i++) {
						// 		this.object_dict[selected_ids[i]].material.emissive.setHex(0xffc107);
						// 	}
						// }
					}
					catch (err) {
						console.log("no entry found in the database");
					}
				});

			}
			console.log("select instance: "+this.selected_id);

			// render view
			this.render_annotation_results();

		}.bind(this);
	}

	on_keydown_keyc(event) {
		if (this.window_mesh.is_mouse_in_model_panel() && event.keyCode === 67) {
			event.preventDefault();
			this.mesh_view = (this.mesh_view + 1) % 2;
			if (this.mesh_view) {
				this.render_mesh_surface();
			}
			else {
				this.render_mesh_annotated();
			}
		}
	}

	on_mouseover_label(id) {
		return function() {			
			// remove the old mesh
			this.scene.remove(this.mesh);

			// parse instance id
			if (id == "label_ALL") {
				this.instance_id = -1;
				if (this.intersected) {
					this.intersected.material.emissive.setHex(this.intersected.currentHex);
				}
			}
			else {
				let ignore_list = [0x218838, 0xff0000, 0xffc107]
				if (this.intersected && this.instance_id != -1 && !(ignore_list.includes(this.intersected.material.emissive.getHex()))) {
					this.intersected.material.emissive.setHex(this.intersected.currentHex);
				}
				this.instance_id = id.split("_").slice(-1)[0];
				this.intersected = this.object_dict[this.instance_id];
				this.intersected.currentHex = this.intersected.material.emissive.getHex();
				this.intersected.material.emissive.setHex(0x0059ff);
			}

		}.bind(this);
	}

	on_window_resize(event) {
		this.window_mesh.on_window_resize(event);
		this.renderer.setSize( this.window_mesh.window_width, this.window_mesh.window_height );
	}

	on_window_scroll(event) {
		this.window_mesh.measure();
	}

	mouseclick(event) {}

    mousedown(event) {
		if (this.window_mesh.is_mouse_in_model_panel()) {
			if (event.button == 0) {
				let intersected = this.raycaster.intersectObjects(this.scene.children.slice(3));
				if (intersected.length > 0) {
					this.selected_id = intersected[0].object.name.split("_")[0];
					this.render_canvas_label(event.clientX, event.clientY);
				}
				else {
					this.selected_id = "-1";
					if (document.getElementById("canvas_label_div")) document.getElementById("id_div_root").removeChild(this.canvas_label);
				}
				this.render_annotation_results();
			}
			else {
				this.selected_id = "-1";
				if (document.getElementById("canvas_label_div")) document.getElementById("id_div_root").removeChild(this.canvas_label);
			}
			this.window_mesh.mousedown(event);
		}
    }

    mouseup(event) {
		if (this.window_mesh.is_mouse_in_model_panel()) {
			this.window_mesh.mouseup(event);
		}
    }

    mousemove(event) {
		if (this.window_mesh.is_mouse_in_model_panel()) {
			this.window_mesh.mousemove(event);
		}
    }

    mousewheel(event) {
		if (document.getElementById("canvas_label_div")) document.getElementById("id_div_root").removeChild(this.canvas_label);
        this.window_mesh.navigation.mousewheel(event);
	}
	
	mouseenter(event) {
		this.window_mesh.mouseenter(event);
	}

	mouseleave(event) {
		this.window_mesh.mouseleave(event);
	}

    contextmenu(event) {
        this.window_mesh.navigation.contextmenu(event);
    }

    attach_listener() {
        // -> event listeners
		this.window_mesh.add_listener('contextmenu', this.contextmenu.bind(this));
        this.window_mesh.add_listener('click', this.mouseclick.bind(this));
        this.window_mesh.add_listener('mousemove', this.mousemove.bind(this));
        this.window_mesh.add_listener('mousedown', this.mousedown.bind(this));
        this.window_mesh.add_listener('mouseup', this.mouseup.bind(this));
		this.window_mesh.add_listener('mousewheel', this.mousewheel.bind(this));
		this.window_mesh.add_listener('mouseenter', this.mouseenter.bind(this));
		this.window_mesh.add_listener('mouseleave', this.mouseleave.bind(this));
		
		window.addEventListener("resize", this.on_window_resize.bind(this));
		window.addEventListener("scroll", this.on_window_scroll.bind(this));
        // <-
	}

	add_listener(element, event, callback, argument=null) {
        this[callback.name+"_ref"] = callback.bind(this);
        if (argument) {
            element.addEventListener(event, this[callback.name+"_ref"](argument));
        }
        else {
            element.addEventListener(event, this[callback.name+"_ref"]);
        }
    }

	add_label_listener() {
		this.labels = [];
		// this.on_click_label_ref = this.on_click_label.bind(this)
		// add ALL label
		let label_ALL_id = "label_ALL";
		let label_ALL = document.getElementById(label_ALL_id);
		this.add_listener(label_ALL, "click", this.on_click_label, label_ALL_id);
		this.add_listener(label_ALL, "mouseover", this.on_mouseover_label, label_ALL_id);
		this.labels.push(label_ALL);
		// add instance labels
		let labels = document.getElementById("label_container").childNodes;
		for (let label_id = 0; label_id < labels.length; label_id++) {
			let cur_id = labels[label_id].id;
			let cur_label = document.getElementById(cur_id);
			this.add_listener(cur_label, "click", this.on_click_label, cur_id);
			this.add_listener(cur_label, "mouseover", this.on_mouseover_label, cur_id);
			this.labels.push(cur_label);
		}
	}

	create_stats() {
		this.stats = new Stats();
		this.stats.domElement.style.position = "absolute";
		this.stats.domElement.style.left = document.getElementById("canvas_container").style.marginLeft;
		document.getElementById("canvas_container").appendChild(this.stats.dom);
	}

	draw_div() {
		ReactDOM.render(<RootUI/>, document.getElementById('id_div_root'));
	}

}

window.MeshViewer = MeshViewer;
