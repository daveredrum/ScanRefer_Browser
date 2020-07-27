export const VS = `#version 300 es
    precision mediump float;
    layout (location = 0) in vec3 position;

    uniform mat4 model_matrix;
    uniform mat4 view_matrix;
    uniform mat4 projection_matrix;

    uniform vec3 plane_normal;
    uniform vec3 plane_point;
    uniform float threshold;
    uniform int n_vertices;

    flat out int belongs_to_plane_vs;

    // uniform mat4 projection_matrix_ortho;

    void main() {
        // According to http://webglstats.com/webgl2/parameter/MAX_TEXTURE_SIZE, 
        // 4096 is the max width/height of a texture that has 100% hardware support
        int w = 4096; 
        int h = int(ceil(float(n_vertices) / float(w)));
        vec2 viewport = vec2(w, h);

		mat4 mvp_matrix = projection_matrix * view_matrix * model_matrix;
		vec4 p = mvp_matrix * vec4(position, 1.0);

        // vec2 coord_vertex = vec2(float(mod(float(gl_VertexID), float(w))) / float(w), 
        //                     float(floor( float(gl_VertexID) / float(w) ) / floor(float(gl_VertexID) / float(w))));

        // coord_vertex = vec2(w/2, h/2);

        // coord_vertex = viewport.xy + viewport.xy * (1 + gl_Position.xy / gl_Position.w)/2 
        // gl_Position = vec4((2.0 * coord_vertex - 2.0 * viewport.xy ) / viewport.xy - 1.0, 1.0, 1.0);
        // gl_Position = vec4((2.0 * coord_vertex - 2.0 * viewport.xy ) / viewport.xy - 1.0, 1.0, 1.0);
        // gl_Position = vec4(coord_vertex.xy, 1, 1);
        gl_Position = p;
        // gl_Position = vec4(0.5,0.5,0.5,1.0);


        belongs_to_plane_vs = int(abs(dot(plane_normal, plane_point - (p.xyz / p.w))) < threshold);
    }
`;

export const FS = `#version 300 es
    precision mediump float;

    flat in int belongs_to_plane_vs;

    layout(location = 0) out vec4 dummy;
    layout(location = 1) out vec4 frag_color;

	void main() {
        dummy = vec4(0);
        // frag_color = vec4(belongs_to_plane_vs, 0, 0, 1.0);
        frag_color = vec4(1.0, 0, 0, 1.0);
    }
`;