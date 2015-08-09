window.fullofstars = window.fullofstars || {};

fullofstars.createAllMaterials = function() {

	function createParticleTexture(texture, tileCounts, offsetNums) { // TODO: Could add invert on both axes, for added variation
        texture.repeat = new THREE.Vector2(1.0 / tileCounts[0], 1.0 / tileCounts[1]);
        texture.offset = new THREE.Vector2(offsetNums[0] / tileCounts[0], 1.0 - ((offsetNums[1]+1) / tileCounts[1]));
        return texture;
    }

    function createParticleMaterial(texture, size, color) {
    	return new THREE.PointCloudMaterial({
    		color: color,
		    size: size,
		    map: texture,
		    blending: THREE.AdditiveBlending,
		    depthTest: false,
		    transparent: true,
		    vertexColors: THREE.VertexColors
	    	});
    }

	var brightTexture = createParticleTexture(THREE.ImageUtils.loadTexture("images/particles.png"), [7,6], [1,1]);
	var dustTexture = createParticleTexture(THREE.ImageUtils.loadTexture("images/particles.png"), [7,6], [0,0]);
	var debrisTexture = createParticleTexture(THREE.ImageUtils.loadTexture("images/particles.png"), [7,6], [1,5]);
	var vortexTexture = createParticleTexture(THREE.ImageUtils.loadTexture("images/particles.png"), [7,6], [0,1]);

	return {
		bright: createParticleMaterial(brightTexture, 170, 0xffffff),
		brightSmall: createParticleMaterial(brightTexture, 90, 0xffffff),
		dust: createParticleMaterial(dustTexture, 50, 0xffffff),
		debrisLarge: createParticleMaterial(debrisTexture, 400, 0x000000)
	}
};
