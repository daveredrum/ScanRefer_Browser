import GLProgram from "../webgl/GLProgram";
import * as CameraSelectionGLSL from "../shader/CameraSelectionGLSL";

class CameraSelection {

	init(gl, window_width, window_height, depth_mode) {
		this.gl = gl;
        this.window_width = window_width;
        this.window_height = window_height;

        this.camera_color_unselected = [0.369, 0.525, 0.776, 0.7];
        this.camera_color_selected = [0, 0.6, 0.408, 0.7];

		this.vao = new Object();
		this.vao.id_program = GLProgram.compile_shaders_and_link_with_program(gl, CameraSelectionGLSL.VS, CameraSelectionGLSL.FS);
        gl.useProgram(this.vao.id_program);

        // positions
        this.vao.id_vbo_triangle_vertices = gl.createBuffer();
        this.vao.id_vbo_line_vertices = gl.createBuffer();
        this.setup_framebuffer()

        gl.useProgram(null);
	}

    setup_framebuffer(){
        let gl = this.gl;
        this.vao.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);

        this.vao.offscreen_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.offscreen_texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.vao.offscreen_texture, 0);

        this.vao.object_indices = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.object_indices);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.vao.object_indices, 0);

        this.vao.depth_unreadable = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.vao.depth_unreadable);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.window_width, this.window_height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.vao.depth_unreadable);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.log("Error with framebuffers");
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }


	upload_data(triangle_vertices, n_triangle_vertices, line_vertices, n_line_vertices) {
		let gl = this.gl;
		let vao = this.vao;

        gl.useProgram(vao.id_program);
		
		vao.n_triangle_vertices = n_triangle_vertices;
        vao.n_line_vertices = n_line_vertices;

        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_triangle_vertices);
        gl.bufferData(gl.ARRAY_BUFFER, triangle_vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_line_vertices);
        gl.bufferData(gl.ARRAY_BUFFER, line_vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.useProgram(null);
	}

    clear_offscreen() {
        let vao = this.vao;
        let gl = this.gl;
        gl.useProgram(vao.id_program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(null);
    }

	draw(model_matrix, view_matrix, projection_matrix, obj_id, is_selected, scale, is_draw_offscreen=false) {
        let vao = this.vao;
        let gl = this.gl;

        gl.useProgram(vao.id_program);
        
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        if (is_draw_offscreen){
            gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        }

        gl.uniform1f(gl.getUniformLocation(vao.id_program, "scale"), scale);
        gl.uniform1i(gl.getUniformLocation(vao.id_program, "obj_id"), obj_id);
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "model_matrix"), false, new Float32Array(model_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "view_matrix"), false, new Float32Array(view_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "projection_matrix"), false, new Float32Array(projection_matrix.elements));

        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_line_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.uniform4f(gl.getUniformLocation(vao.id_program, "color"), 0.1, 0.1, 0.1, 0.8);
        gl.drawArrays(gl.LINES, 0, vao.n_line_vertices);

        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_triangle_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        if (is_selected){
            gl.uniform4f(gl.getUniformLocation(vao.id_program, "color"), this.camera_color_selected[0], this.camera_color_selected[1], this.camera_color_selected[2], this.camera_color_selected[3]);
        }
        else {
            gl.uniform4f(gl.getUniformLocation(vao.id_program, "color"), this.camera_color_unselected[0], this.camera_color_unselected[1], this.camera_color_unselected[2], this.camera_color_unselected[3]);
        }
        
        gl.drawArrays(gl.TRIANGLES, 0, vao.n_triangle_vertices);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.useProgram(null);
	}

    get_camera_id(x, y) {
        let vao = this.vao;
        let gl = this.gl;
        gl.useProgram(vao.id_program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        let pixel = new Uint8Array(4);
        gl.readPixels(x, this.window_height - y, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel, 0);
        
        let camera_id = -1;
        if (pixel[0]==255) {
            camera_id = pixel[1] + pixel[2] * 256;
        }
        
        gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        gl.useProgram(null);
        return camera_id;
    }

}

export default CameraSelection;