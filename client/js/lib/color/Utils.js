// Modified from https://gist.github.com/ollieglass/f6ddd781eeae1d24e391265432297538
let MAX_CONTRAST_COLORS = [
	'#BE0032',
	'#008856',
	'#0067A5',
	'#F38400',
	'#875692',
	'#F3C300',
	'#A1CAF1',
	'#B3446C',
	'#8DB600',
	'#604E97',
	'#DCD300',
	'#E68FAC',
	'#E25822',
	'#FF0000',
	'#00FF00',
	'#0000FF',
	'#882D17',
	'#F6A600',
	'#F99379',
	'#654522',
];

class ColorCycle{
	constructor(){
		this.colors = MAX_CONTRAST_COLORS.slice();
		this.idx = 0;
	}

	get_next_color(){
		return this.colors[this.idx++ % this.colors.length];
	}
}

exports.COLOR_CYCLE = new ColorCycle();

exports.byte_array_to_rgba_str = function(arr){
    /* Assumes arr in [0...255]^4 */
    return `rgba(${arr[0]}, ${arr[1]}, ${arr[2]}, ${1.0 * arr[3] / 255})`;   
}

exports.byte_array_to_rgb_str = function(arr){
    /* Assumes arr in [0...255]^4 */
    return `rgba(${arr[0]}, ${arr[1]}, ${arr[2]})`;   
}

exports.hex_str_to_byte_array = function(hexstr){
	// Modified from https://stackoverflow.com/a/34356351
	let hex = hexstr[0] === "#" ? hexstr.slice(1) : hexstr;
	let bytes = [], c = 0;
    for (; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}