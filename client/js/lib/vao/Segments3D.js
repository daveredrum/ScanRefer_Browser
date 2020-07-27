import GLProgram from "../webgl/GLProgram";
import * as Segments3DGLSL from "../shader/Segments3DGLSL";


class Segments3D {

    init(gl, window_width, window_height) {
        this.gl = gl;
        this.window_width = window_width;
        this.window_height = window_height;

        this.vao = new Object();
        
        // Shaders for drawing to screen
        this.vao.id_program = GLProgram.compile_shaders_and_link_with_program(gl, Segments3DGLSL.VS, Segments3DGLSL.FS);

        gl.useProgram(this.vao.id_program);

        // positions
        this.vao.id_vbo_vertices = gl.createBuffer();

        // normals
        this.vao.id_vbo_normals = gl.createBuffer();

        // segment_ids
        this.vao.id_vbo_segment_ids = gl.createBuffer();

        // texture
        this.color_texture = gl.createTexture();

        // setup frame buffer
        this.setup_framebuffer()

        gl.useProgram(null);
    }

    load_color_texture(colors) {
        let vao = this.vao;
        let gl = this.gl;  
        gl.useProgram(this.vao.program);
        gl.bindTexture(gl.TEXTURE_2D, this.color_texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, colors);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
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

        this.vao.out_segment_indices = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.out_segment_indices);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.vao.out_segment_indices, 0);

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

    upload_data(positions, normals, segment_ids, n_positions) {
        /*
            Loads data into gpu memory
            TODO: consider using gl.getAttribLocation() instead of hardcoded index for vertexAttribPointer
        */
        let gl = this.gl;
        let vao = this.vao;

        gl.useProgram(vao.id_program);
        
        vao.n_positions = n_positions;

        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_segment_ids);
        gl.bufferData(gl.ARRAY_BUFFER, segment_ids, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
    }

    clear() {
        let vao = this.vao;
        let gl = this.gl;
        gl.useProgram(vao.id_program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.clearColor(255/255.0, 255/255.0, 254/255.0, 1.0); 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(null);
    }

    draw(model_matrix, view_matrix, projection_matrix) {
        let vao = this.vao;
        let gl = this.gl;
        
        gl.useProgram(vao.id_program);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        // normals
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);

        // segmentids
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_segment_ids);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(2);

        // color texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.color_texture);
        gl.uniform1i(gl.getUniformLocation(vao.id_program, "sampler"), 0);

        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "model_matrix"), false, new Float32Array(model_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "view_matrix"), false, new Float32Array(view_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "projection_matrix"), false, new Float32Array(projection_matrix.elements));
        //gl.uniform4fv(gl.getUniformLocation(vao.id_program, "colors"), colors);
        
        gl.drawArrays(gl.TRIANGLES, 0, vao.n_positions);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.useProgram(null);
	}

    get_segment_id(x, y) {
        let vao = this.vao;
        let gl = this.gl;
        gl.useProgram(vao.id_program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        let pixel = new Uint8Array(4);
        gl.readPixels(x, this.window_height - y, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel, 0);
        
        let segment_id = -1;
        if (pixel[2]==255)
            segment_id = pixel[0] + pixel[1] * 256;
        
        gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        gl.useProgram(null);
        return segment_id;
    }

}

export default Segments3D;