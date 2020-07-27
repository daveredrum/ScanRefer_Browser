export const VS = `#version 300 es
    precision mediump float;
    layout (location = 0) in vec4 position;
    layout (location = 1) in vec3 normal;

    uniform mat4 model_matrix;
    uniform mat4 view_matrix;
    uniform mat4 projection_matrix;
    uniform vec4 colorRGBA;

    out vec3 position_vs;
    out vec3 normal_vs;
    out vec4 color_vs;

    void main() {
		mat4 mvp_matrix = projection_matrix * view_matrix * model_matrix;
		gl_Position = mvp_matrix * position;

		mat4 normal_matrix = transpose(inverse(model_matrix));

		vec4 temp_position = model_matrix * position;
		position_vs = temp_position.xyz;
		normal_vs = vec3(normal_matrix * vec4(normal, 0));
		color_vs = colorRGBA;
    }
`;

export const FS = `#version 300 es
    precision mediump float;

    in vec3 position_vs;
    in vec3 normal_vs;
    in vec4 color_vs;

    const vec3 la = vec3(0.3);
    const vec3 ld = vec3(1.0);
    const vec3 ls = vec3(0.0);


    const vec3 ka = vec3(1.0, 1.0, 1.0);
    const vec3 ks = vec3(0.5, 0.5, 0.5);
    const float shininess = 1.0;

    uniform mat4 model_matrix;
    uniform mat4 view_matrix;

    layout(location = 0) out vec4 frag_color;

	void main() {
        vec3 normal = normalize(normal_vs);

        vec3 s = normalize(inverse(view_matrix)[2].xyz);
        vec3 v = normalize(-position_vs);
        vec3 r = reflect(-s, normal);

        float sDotN = max(dot(s, normal), 0.0);
        vec3 ambient = la * ka;
        vec3 diffuse = ld * color_vs.xyz * sDotN;
        vec3 specular = vec3(0.0);
        if( sDotN > 0.0 )
            specular = ls *ks * pow(max(dot(r,v), 0.0), shininess);

        // frag_color = vec4( diffuse + ambient + specular, color_vs.w );
        // frag_color = vec4(1.0, 0.0, 0.0, 1.0);
        frag_color = color_vs;
    }
`;