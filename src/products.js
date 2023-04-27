const express = require("express");
const { RPCRequest, RPCObserver } = require("./rpc");

const app = express();
const PORT = 9001;
app.use(express.json());

const fakeProductResponse = {
  _id: "yt686tu8763tyyr98734",
  title: "iPhone",
  price: 600,
};

RPCObserver("PRODUCT_RPC", fakeProductResponse);

app.use("/customer", async (req, res, next) => {
  const requestPayload = {
    customerId: "yt686tu8763tyyr98734",
  };
  try {
    const responseData = await RPCRequest("CUSTOMER_RPC", requestPayload);
    console.log(responseData);
    return res.status(200).json(responseData);
  } catch (error) {
    return res.status(500).json("Data Not Found");
  }
});

app.use("/", (req, res, next) => {
  return res.json("Product service");
});

app.listen(PORT, () => {
  console.log(`Product is Running on ${PORT}`);
  console.clear();
});
