window.fullofstars = window.fullofstars || {};

fullofstars.createAllMaterials = function() {

	function createParticleTexture(texture, tileCounts, offsetNums) { // TODO: Could add invert on both axes, for added variation
        texture.repeat = new THREE.Vector2(1.0 / tileCounts[0], 1.0 / tileCounts[1]);
        texture.offset = new THREE.Vector2(offsetNums[0] / tileCounts[0], 1.0 - ((offsetNums[1]+1) / tileCounts[1]));
        return texture;
    }

    function createParticleMaterial(texture, size, color, blending, opacity) {
    	return new THREE.PointCloudMaterial({
    		color: color,
    		opacity: opacity,
		    size: size,
		    map: texture,
		    blending: blending,
		    depthTest: false,
		    transparent: true,
		    vertexColors: THREE.VertexColors
	    	});
    }

	var starLargeTexture = THREE.ImageUtils.loadTexture("images/star_large.png");
	var starSmallTexture = THREE.ImageUtils.loadTexture("images/star_small.png");
	var gasCloudTexture = THREE.ImageUtils.loadTexture("images/cloud_01.png");

	return {
		bright: createParticleMaterial(starLargeTexture, 140, 0xffffff, THREE.AdditiveBlending, 1.0),
		brightSmall: createParticleMaterial(starSmallTexture, 60, 0xffffff, THREE.AdditiveBlending, 1.0),
		gasCloud: createParticleMaterial(gasCloudTexture, 1100, 0xffffff, THREE.NormalBlending, 0.28)
	}
};
