const PDFDocument = require("pdfkit");

exports.generateInvoice = (req, res) => {
  const doc = new PDFDocument();
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(20).text("Dhanlaxmi Krushi Kendra Invoice");
  doc.moveDown();

  req.body.items.forEach(i => {
    doc.text(`${i.name} × ${i.qty} = ₹${i.price * i.qty}`);
  });

  doc.end();
};
