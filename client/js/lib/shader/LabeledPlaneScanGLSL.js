export const VS = `#version 300 es
    precision mediump float;
    layout (location = 0) in vec4 position;
    layout (location = 1) in vec3 normal;
    layout (location = 2) in vec2 uv;
    layout (location = 3) in vec4 plane_color;

    uniform mat4 model_matrix;
    uniform mat4 view_matrix;
    uniform mat4 projection_matrix;

    flat out vec3 position_vs;
    flat out vec4 plane_color_vs;
    out vec3 normal_vs;
    out vec2 uv_vs;

    void main() {
		mat4 mvp_matrix = projection_matrix * view_matrix * model_matrix;
		gl_Position = mvp_matrix * position;

		mat4 normal_matrix = transpose(inverse(model_matrix));

		vec4 temp_position = model_matrix * position;
		position_vs = temp_position.xyz;
		normal_vs = vec3(normal_matrix * vec4(normal, 0));

		uv_vs = uv;
        plane_color_vs = plane_color;
    }
`;

export const FS = `#version 300 es
    precision mediump float;

    flat in vec3 position_vs;
    flat in vec4 plane_color_vs;
    in vec3 normal_vs;
    in vec2 uv_vs;

    const vec3 la = vec3(0.3);
    const vec3 ld = vec3(1.0);
    const vec3 ls = vec3(0.0);

    const vec3 ka = vec3(1.0, 1.0, 1.0);
    const vec3 ks = vec3(0.5, 0.5, 0.5);
    const float shininess = 1.0;

    uniform mat4 model_matrix;
    uniform mat4 view_matrix;
    uniform sampler2D sampler;

    layout(location = 0) out vec4 frag_color;

    float near = 0.5;
    float far = 5.0;

	void main() {
        vec4 t_color = texture(sampler, uv_vs);

        vec3 normal = normalize(normal_vs);

        vec3 s = normalize(inverse(view_matrix)[2].xyz);
        vec3 v = normalize(-position_vs);
        vec3 r = reflect(-s, normal);

        float sDotN = max(dot(s, normal), 0.0);
        vec3 ambient = la * ka;
        vec3 diffuse = ld * vec3(t_color) * sDotN;
        vec3 specular = vec3(0.0);
        if( sDotN > 0.0 )
            specular = ls *ks * pow(max(dot(r,v), 0.0), shininess);

        frag_color = vec4(mix((diffuse + ambient + specular), plane_color_vs.rgb, plane_color_vs.a), 1.0);
    }
`;