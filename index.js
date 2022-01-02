// import dependencies
const console = require("console");
const dotenv = require("dotenv");
dotenv.config(); // setup dotenv

// utilise Moralis
const Moralis = require("moralis/node");

// canvas for image compile
const { createCanvas } = require("canvas");

// import config
const {
  layers,
  width,
  height,
  editionSize,
  startEditionFrom,
  rarityWeights
} = require("./input/config.js");

// import metadata
const { compileMetadata } = require("./src/metadata");

// import for saving files
const { createFile } = require("./src/filesystem");

// setup canvas
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

// Moralis creds

const serverUrl = process.env.SERVER_URL;
const appId = process.env.APP_ID;
const masterKey = process.env.MASTER_KEY;
const apiUrl = process.env.API_URL;
// xAPIKey available here: https://deep-index.moralis.io/api-docs/#/storage/uploadFolder
const apiKey = process.env.API_KEY;

// Start Moralis session

Moralis.start({ serverUrl, appId, masterKey });

// Create generative art by using the canvas api
const startCreating = async () => {
  console.log("##################");
  console.log("# Generative Art #");
  console.log("# - Generating your NFT collection");
  console.log("##################");

  // image data collection
  let imageDataArray = [];

  // create NFTs from startEditionFrom to editionSize
  let editionCount = startEditionFrom;

  while (editionCount <= editionSize) {
    console.log("-----------------");

    console.log("Mutating %d of %d", editionCount, editionSize);

    // upload to ipfs
    const saveFileIPFS = async () => {
      // get rarity from to config to create NFT as
      let rarity = getRarity(editionCount);
      console.log("- rarity: " + rarity);

      // calculate the NFT dna by getting a random part for each layer/feature
      // based on the ones available for the given rarity to use during generation
      let newDna = createDna(layers, rarity);
      while (!isDnaUnique(dnaListByRarity[rarity], newDna)) {
        // recalculate dna as this has been used before.
        console.log(
          "found duplicate DNA " + newDna.join("-") + ", recalculate..."
        );
        newDna = createDna(layers, rarity);
      }
      console.log("- dna: " + newDna.join("-"));

      // propagate information about required layer contained within config into a mapping object
      // = prepare for drawing
      let results = constructLayerToDna(newDna, layers, rarity);
      let loadedElements = [];

      // load all images to be used by canvas
      results.forEach((layer) => {
        loadedElements.push(loadLayerImg(layer));
      });

      let attributesList = [];

      await Promise.all(loadedElements).then((elementArray) => {
        // create empty image
        ctx.clearRect(0, 0, width, height);
        // draw a random background color
        drawBackground();
        // store information about each layer to add it as meta information
        attributesList = [];
        // draw each layer
        elementArray.forEach((element) => {
          drawElement(element);
          attributesList.push(getAttributeForElement(element));
        });
        // add an image signature as the edition count to the top left of the image
        signImage(`#${editionCount}`);
        // write the image to the output directory
      });
      dnaListByRarity[rarity].push(newDna);

      const base64ImgData = canvas.toBuffer();
      const base64 = base64ImgData.toString("base64");

      let filename = editionCount.toString() + ".png";
      let filetype = "image/png";

      // save locally as file
      fs.writeFileSync(`./output/${filename}`, canvas.toBuffer(filetype));

      // save to hosted IPFS file
      const file = new Moralis.File(filename, { base64: base64 });
      const fileIpfs = await file.saveIPFS({ useMasterKey: true });

      const filePath = file.ipfs();
      const fileHash = file.hash();

      const metadata = {
        name: filename,
        nftFilePath: filePath,
        nftFileHash: fileHash,
      };

      console.log("Metadata: ", metadata);
      console.log("File Path: ", filePath);
      console.log(
        "Brother " + editionCount.toString() + " a brother of the gum."
      );

      const data = {
        editionCount: editionCount,
        filePath: filePath,
        fileHash: fileHash,
        newDna: newDna,
        attributesList: attributesList,
        file: file,
      };

      return data;
    };

    // upload metadata
    const uploadMetadata = async (_params) => {
      // do something else here after firstFunction completes
      let nftMetadata = generateMetadata(
        _params.newDna,
        _params.editionCount,
        _params.attributesList,
        _params.filePath
      );
      metadataList.push(nftMetadata);

      const metaFile = new Moralis.File(editionCount.toString() + ".json", {
        base64: Buffer.from(
          JSON.stringify(
            metadataList.find((meta) => meta.edition == _params.editionCount)
          )
        ).toString("base64"),
      });

      // save locally as file
      fs.writeFileSync(
        `./output/${editionCount}.json`,
        JSON.stringify(
          metadataList.find((meta) => meta.edition == editionCount)
        )
      );
      // save to hosted IPFS file
      let _metaFile = await metaFile.saveIPFS({ useMasterKey: true });

      // Save file reference to Moralis
      const FileDatabase = new Moralis.Object("Files");
      FileDatabase.set("name", _params.editionCount.toString());
      FileDatabase.set("path", _params.filePath);
      FileDatabase.set("hash", _params.filePath);
      FileDatabase.set("imagefile", _params.file);
      FileDatabase.set("metafile", metaFile);
      await FileDatabase.save();
    };


    const handleFinal = async () => {
      // create image files and return object array of created images
      [...imageDataArray] = await createFile(
        canvas,
        ctx,
        layers,
        width,
        height,
        editionCount,
        editionSize,
        rarityWeights,
        imageDataArray
      );
    };

    await handleFinal();
    // iterate
    editionCount++;
  }

  await compileMetadata(
    apiUrl,
    apiKey,
    editionCount,
    editionSize,
    imageDataArray
  );

  console.log();
  console.log("#########################################");
  console.log("Welcome to Rekt City - Meet the Survivors");
  console.log("#########################################");
  console.log();
};

// Initiate code
startCreating();
