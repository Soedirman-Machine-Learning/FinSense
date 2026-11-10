// middleware/validate.js
const validate = (validatorFn) => (req, res, next) => {
  const { error, value } = validatorFn(req.body);
  if (error) {
    const messages = error.details.map((err) => err.message);
    return res.status(400).json({ errors: messages });
  }
  // (Opsional) timpa req.body dengan value hasil koersi tipe data
  req.body = value;
  next();
};

module.exports = validate;
