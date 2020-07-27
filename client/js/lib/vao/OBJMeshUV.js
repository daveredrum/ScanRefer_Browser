import GLProgram from "../webgl/GLProgram";
import * as OBJMeshUVGLSL from "../shader/OBJMeshUVGLSL";
import * as AttrReaderGLSL from "../../lib/shader/AttrReaderGLSL";

class OBJMeshUV {


    init(gl, window_width, window_height, depth_mode=1) {
        this.gl = gl;
        this.window_width = window_width;
        this.window_height = window_height;

        this.vao = new Object();
        
        // Shaders for drawing to screen
        this.vao.onscreen_program = GLProgram.compile_shaders_and_link_with_program(gl, OBJMeshUVGLSL.VS, OBJMeshUVGLSL.FS.format(depth_mode));
        // Shaders for reading depth and normal
        this.vao.depth_normal_reader_program = GLProgram.compile_shaders_and_link_with_program(gl, AttrReaderGLSL.DepthNormalVS, AttrReaderGLSL.DepthNormalFS);
        // Shaders used in draw()
        this.vao.id_program = this.vao.onscreen_program;

        gl.useProgram(this.vao.id_program);

        // positions
        this.vao.id_vbo_vertices = gl.createBuffer();

        // normals
        this.vao.id_vbo_normals = gl.createBuffer();

        // uvs
        this.vao.id_vbo_uvs = gl.createBuffer();

        // texture
        this.vao.texture = gl.createTexture();
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.vao.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        //gl.bindTexture(gl.TEXTURE_2D, null);

        this.setup_framebuffer();
        gl.useProgram(null);
    }

    setup_framebuffer(){
        /*
            Creates an offscreen buffer that allows access to object depth values
        */

        let gl = this.gl;

        this.vao.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);

        // Dummy
        this.vao.offscreen_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.offscreen_texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.vao.offscreen_texture, 0);

        // Texture for reading/rendering depth
        this.vao.depth_readable = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.depth_readable);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.vao.depth_readable, 0);

        // Textures for reading/rendering normal
        // We need three -- one for each component of the normal -- since we are using the first 24 bits of color to
        //  store a floating point
        this.vao.normal_readable_x = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.normal_readable_x);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.vao.normal_readable_x, 0);

        this.vao.normal_readable_y = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.normal_readable_y);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, this.vao.normal_readable_y, 0);

        this.vao.normal_readable_z = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.vao.normal_readable_z);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.window_width, this.window_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT4, gl.TEXTURE_2D, this.vao.normal_readable_z, 0);

        // Dummy
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

    upload_data(positions, normals, uvs, image, n_positions) {
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
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_uvs);
        gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, vao.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.useProgram(null);
    }

    draw(model_matrix, view_matrix, projection_matrix, is_draw_offscreen) {
        let vao = this.vao;
        let gl = this.gl;
        
        gl.useProgram(vao.id_program);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        if (is_draw_offscreen){
            gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
            gl.clearColor(230/255.0, 240/255.0, 230/255.0, 1.0);  // Clear to black, fully opaque
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_vertices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        // normals
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_normals);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);

        // uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, vao.id_vbo_uvs);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(2);

        // texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, vao.texture);

        gl.uniform1i(gl.getUniformLocation(vao.id_program, "sampler"), 0);
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "model_matrix"), false, new Float32Array(model_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "view_matrix"), false, new Float32Array(view_matrix.elements));
        gl.uniformMatrix4fv(gl.getUniformLocation(vao.id_program, "projection_matrix"), false, new Float32Array(projection_matrix.elements));

        gl.drawArrays(gl.TRIANGLES, 0, vao.n_positions);

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(null);
    }

    setup_depth_map() {
        let vao = this.vao;
        let gl = this.gl;
        
        gl.useProgram(vao.id_program);

        gl.bindFramebuffer(gl.FRAMEBUFFER, vao.fbo);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        let pixels = new Uint8Array(this.window_height * this.window_width * 4);
        gl.readPixels(0, 0, this.window_width, this.window_height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels, 0);
        
        let depth = new Float32Array(this.window_height * this.window_width);
        for (let i = 0; i < this.window_height; i++) {
            for (let j = 0; j < this.window_width; j++) {
                depth[i * this.window_width + j] = 0;
                depth[i * this.window_width + j] |= pixels[((this.window_height - 1 - i) * this.window_width + j) * 4 + 0] << 0;
                depth[i * this.window_width + j] |= pixels[((this.window_height - 1 - i) * this.window_width + j) * 4 + 1] << 8;
                depth[i * this.window_width + j] |= pixels[((this.window_height - 1 - i) * this.window_width + j) * 4 + 2] << 16;
                depth[i * this.window_width + j] /= 16777215.0; 
            }
        }
    
        gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        gl.useProgram(null);
        this.depth_map = depth;
    }

    world_pos_from_canvas_pos(canvas_pos, window_manager){
        /*
            Calculates world coordinates (as THREE.Vector4) by sampling the depth buffer at canvas_pos
        */
        let gl = this.gl;

        // Set offscreen buffer
        this.vao.id_program = this.vao.depth_normal_reader_program;
        
        // Draw scan to offscreen depth buffer
        this.draw(this.model_matrix, window_manager.camera.matrixWorldInverse, window_manager.projection_matrix, true);

        // Reset scan_vao.id_program
        this.vao.id_program = this.vao.onscreen_program;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        let offscreen_depth = new Uint8Array(4);  // One byte for each RGBA channel

        // We invert y here because canvas coords are from top left, whereas gl texture coords are from bottom left
        gl.readPixels(canvas_pos.x, (window_manager.window_height - canvas_pos.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, offscreen_depth, 0);

        let depth = this.rgba_tuple_to_float(offscreen_depth);

        // Transform from NDC to world
        return window_manager.project_ndc_to_world(
                    new THREE.Vector4(
                         (canvas_pos.x / window_manager.window_width) * 2.0 - 1.0,
                        -(canvas_pos.y / window_manager.window_height) * 2.0 + 1.0, // Y is inverted again
                          depth * 2.0 - 1.0, 1));
    }

    normal_from_canvas_pos(canvas_pos, window_manager){
        /*
            Calculates world coordinates (as THREE.Vector4) by sampling the depth buffer at canvas_pos
        */
        let gl = this.gl;

        // Set offscreen buffer
        this.vao.id_program = this.vao.depth_normal_reader_program;
        
        // Draw scan to offscreen depth buffer
        this.draw(this.model_matrix, window_manager.camera.matrixWorldInverse, window_manager.projection_matrix, true);

        // Reset scan_vao.id_program
        this.vao.id_program = this.vao.onscreen_program;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.vao.fbo);

        // Get normal, one component at a time
        let normal = new THREE.Vector3();
        for (let i=0; i<3; i++){
            let normal_component = new Uint8Array(4);
            gl.readBuffer(gl['COLOR_ATTACHMENT' + (i + 2)]);  // Each component of normal is stored in its own texture (x:2, y:3, z:4)
            
            // We invert y here because canvas coords are from top left, whereas gl texture coords are from bottom left
            gl.readPixels(canvas_pos.x, (window_manager.window_height - canvas_pos.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, normal_component, 0);
            
            normal.setComponent(i, this.rgba_tuple_to_float(normal_component) * 2.0 - 1.0);
        }

        return normal;
    }

    rgba_tuple_to_float(rgba_tuple){
        /* 
            Extracts a 24bit floating point stored in a 4-tuple of unsigned integers (see shader for encoding proceedure)
        */
        let float_out = 0;
        float_out |= rgba_tuple[0] << 0;
        float_out |= rgba_tuple[1] << 8;
        float_out |= rgba_tuple[2] << 16;
        float_out /= 16777215.0;  // Divide by 2^24 - 1 so the float_out is in [0,1), undoing the multiplication in the shader

        return float_out;
    }

}

export default OBJMeshUV;