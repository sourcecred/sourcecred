import {DataProvider} from 'ra-core';


const getOneGrainConfig = (params) => {
    const _obj  = { "id" : 1, "maxSimultaneousDistributions": 145 }
    return Promise.resolve({data: _obj});
}

const getOneFruitConfig = (params) => {
    const _obj = {
        "id": 1,
        "fruit": [
          {
            "fruitType": "apple",
            "appleType": "granny smith",
          },
          {
            "fruitType": "banana",
            "color": "green",
          },
          {
             "fruitType": "cherry",
             "cherryType": "raineer",
             "color": "yellow",
          }
        ]
      };
      
    return Promise.resolve({data: _obj});
}

const updateGrainConfig = (params) => {

};
const updateFruitConfig = (params) => {
    console.log(params);
    return Promise.resolve({data: {id: 1}});
};

// eslint-disable-next-line flowtype/no-types-missing-file-annotation
export default (data): DataProvider => {
    const _obj = {id: 1};
    return {        getList:    (resource, params) => Promise.resolve({data: [_obj], total: 1}),
        getOne:     (resource, params) => {
            switch(resource) {
                case "GrainConfig":
                    return getOneGrainConfig(params);
                case "FruitConfig":
                    return getOneFruitConfig(params);
            }
        },
        getMany:    (resource, params) => Promise.resolve({data: [_obj]}),
        getManyReference: (resource, params) => Promise.resolve({data: [_obj], total: 1}),
        create:     (resource, params) => Promise.resolve({data: _obj}),
        update:     (resource, params) => {
            switch(resource) {
                case "GrainConfig":
                    return updateGrainConfig(params);
                case "FruitConfig":
                    return updateFruitConfig(params);
            }
        },
        updateMany: (resource, params) => Promise.resolve({data: [1]}),
        delete:     (resource, params) => Promise.resolve({data: _obj}),
        deleteMany: (resource, params) => Promise.resolve({data: [1]})
    }
}