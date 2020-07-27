import * as THREE from 'three/build/three';

export function create_camera() {
	const line_vertices = new Float32Array([
		-0.5, -0.5,  0.5,
		 0.5, -0.5,  0.5,
											 
		 0.5, -0.5,  0.5,
		 0.5,  0.5,  0.5,

		 0.5,  0.5,  0.5,
		-0.5,  0.5,  0.5,

		-0.5,  0.5,  0.5,
		-0.5, -0.5,  0.5,

		-0.5, -0.5,  0.5,
		 0.0,  0.0, -0.5,
						
 		 0.5, -0.5,  0.5,
 		 0.0, -0.0, -0.5,
		 					
		 0.5,  0.5,  0.5,
 		 0.0,  0.0, -0.5,

 		-0.5,  0.5,  0.5,	
 		-0.0,  0.0, -0.5,
	]);

	const traingle_vertices = new Float32Array([
		-0.5, -0.5,  0.5,
		 0.5, -0.5,  0.5,
		 0.5,  0.5,  0.5,
		
		-0.5, -0.5,  0.5,
 		 0.5,  0.5,  0.5,
		-0.5,  0.5,  0.5,
		
		-0.5, -0.5,  0.5,
		 0.0,  0.0, -0.5,
		 0.5, -0.5,  0.5,
		
		-0.5, -0.5,  0.5,
		-0.5,  0.5,  0.5,
		 0.0,  0.0, -0.5,
		
		 0.5, -0.5,  0.5,
		 0.0,  0.0, -0.5,
		 0.5,  0.5,  0.5,
		
		-0.5,  0.5,  0.5,
		 0.5,  0.5,  0.5,
		 0.0,  0.0, -0.5
	]);

	return {line_vertices : line_vertices, triangle_vertices: traingle_vertices, n_line_vertices : 16,  n_triangle_vertices : 18};
}