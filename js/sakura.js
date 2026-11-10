function initSakura() {
    const canvas = document.getElementById('sakura-canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const petals = Array.from({ length: 35 }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        size: Math.random() * 8 + 6, speedY: Math.random() * 1 + 0.8,
        speedX: Math.random() * 0.5 - 0.25, angle: Math.random() * 360, spin: Math.random() * 0.02 - 0.01
    }));

    function render() {
        ctx.clearRect(0, 0, width, height);
        petals.forEach(p => {
            p.y += p.speedY; p.x += p.speedX; p.angle += p.spin;
            if (p.y > height) p.y = -10;
            if (p.x > width) p.x = 0; if (p.x < 0) p.x = width;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = '#ffb7c5';
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        requestAnimationFrame(render);
    }
    render();
}