export const VS = `#version 300 es
    precision mediump float;
    layout (location = 0) in vec4 position;
    layout (location = 1) in vec3 normal;
    layout (location = 2) in vec2 uv;

    uniform mat4 model_matrix;
    uniform mat4 view_matrix;
    uniform mat4 projection_matrix;

    out vec3 position_vs;
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
    }
`;

export const FS = `#version 300 es
    #define DEPTH_OUTPUT_MODE {0} // depth output mode 0 is meant for displaying, 1 is meant for using the depth values
    precision mediump float;

    in vec3 position_vs;
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
    layout(location = 1) out vec4 depth;

    float near = 0.5;
    float far = 5.0;

	void main() {
        vec4 t_color = texture(sampler, uv_vs);
        
        // Don't use lighting when using texture map -- looks better
        
        // vec3 normal = normalize(normal_vs);

        // vec3 s = normalize(inverse(view_matrix)[2].xyz);
        // vec3 v = normalize(-position_vs);
        // vec3 r = reflect(-s, normal);

        // float sDotN = max(dot(s, normal), 0.0);
        // vec3 ambient = la * ka;
        // vec3 diffuse = ld * vec3(t_color) * sDotN;
        // vec3 specular = vec3(0.0);
        // if( sDotN > 0.0 )
        //     specular = ls *ks * pow(max(dot(r,v), 0.0), shininess);
        // frag_color = vec4( diffuse + ambient + specular, 1 );
    
        frag_color = t_color; 
    
    #if DEPTH_OUTPUT_MODE==0
        float z_ndc = 2.0 * gl_FragCoord.z - 1.0;
        float z_linear = 2.0*near*far/(far + near - z_ndc*(far - near))/(far - near);
        depth = vec4(z_linear, z_linear, z_linear, 1.0);
    #else
        int z_linear_int = int(gl_FragCoord.z * float(1 << 24));
        int r1 = (z_linear_int & 0x000000FF) >> 0;
        int g1 = (z_linear_int & 0x0000FF00) >> 8;
        int b1 = (z_linear_int & 0x00FF0000) >> 16;
        depth = vec4(float(r1)/255.0, float(g1)/255.0, float(b1)/255.0, 1.0);
    #endif
    }
`;