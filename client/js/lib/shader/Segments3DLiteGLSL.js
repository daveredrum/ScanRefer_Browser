export const VS = `#version 300 es
    precision mediump float;

    layout (location = 0) in vec4 position;
    layout (location = 1) in float segment_id;
 
    uniform mat4 model_matrix;
    uniform mat4 view_matrix;
    uniform mat4 projection_matrix;
    flat out int segment_id_vs;

    void main() {
		mat4 mvp_matrix = projection_matrix * view_matrix * model_matrix;
		gl_Position = mvp_matrix * position;
        segment_id_vs = int(segment_id);
    }
`;

export const FS = `#version 300 es
    precision mediump float;

    flat in int segment_id_vs;
    
    layout(location = 0) out vec4 out_segment_id;
    
	void main() {
        int r1 = (int(segment_id_vs) & 0x000000FF) >> 0;
        int g1 = (int(segment_id_vs) & 0x0000FF00) >> 8;
        out_segment_id = vec4(float(r1)/255.0, float(g1)/255.0, 1.0, 1.0);
    }
`;