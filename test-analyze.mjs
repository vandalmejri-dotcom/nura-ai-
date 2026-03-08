fetch("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        text: "Un vecteur est une entité mathématique possédant une magnitude et une direction. Notation : \\vec{a}. Produit scalaire : a·b = |a||b|cosθ"
    })
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(err => console.error(err));
