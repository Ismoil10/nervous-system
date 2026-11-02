---
source_url: "https://en.wikipedia.org/api/rest_v1/page/html/Biological_neuron_model"
type: webpage
title: "Biological neuron model"
captured_at: 2026-10-31T12:20:05.938830+00:00
contributor: "Claude"
---

# Biological neuron model

Source: https://en.wikipedia.org/api/rest_v1/page/html/Biological_neuron_model

---

Biological neuron model

Mathematical descriptions of the properties of certain cells in the nervous system



|  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- |
|  | **This article has multiple issues.** Please help **[improve it](./Special:EditPage/Biological_neuron_model "Special:EditPage/Biological neuron model")** or discuss these issues on the **[talk page](./Talk:Biological_neuron_model "Talk:Biological neuron model")**. *([Learn how and when to remove these messages](./Help:Maintenance_template_removal "Help:Maintenance template removal"))* |  |  | | --- | --- | |  | This article's style of writing **may not reflect the [encyclopedic tone](./Wikipedia:Writing_better_articles#Tone "Wikipedia:Writing better articles") used on Wikipedia**. See Wikipedia's [guide to writing better articles](./Wikipedia:Writing_better_articles#Tone "Wikipedia:Writing better articles") for suggestions. *(August 2023)* *([Learn how and when to remove this message](./Help:Maintenance_template_removal "Help:Maintenance template removal"))* |    |  |  | | --- | --- | |  | This article **may be too technical for most readers to understand**. Please [help improve it](https://en.wikipedia.org/w/index.php?title=Biological_neuron_model&action=edit) to [make it understandable to non-experts](./Wikipedia:Make_technical_articles_understandable "Wikipedia:Make technical articles understandable"), without removing the technical details. *(August 2023)* *([Learn how and when to remove this message](./Help:Maintenance_template_removal "Help:Maintenance template removal"))* |  *([Learn how and when to remove this message](./Help:Maintenance_template_removal "Help:Maintenance template removal"))* |



Fig. 1. Neuron and myelinated axon, with signal flow from inputs at dendrites to outputs at axon terminals. The signal is a short electrical pulse called action potential or 'spike'.



Fig 2. Time course of neuronal [action potential](./Action_potential "Action potential") ("spike"). Note that the amplitude and the exact shape of the action potential can vary according to the exact experimental technique used for acquiring the signal.

**Biological neuron models**, also known as **spiking** **neuron models**,[[1]](./Biological_neuron_model#cite_note-Gerstner_2002-1) are mathematical descriptions of the conduction of electrical signals in [neurons](./Neuron "Neuron"). Neurons (or nerve cells) are [electrically excitable](./Membrane_potential "Membrane potential") cells within the [nervous system](./Nervous_system "Nervous system"), able to fire electric signals, called [action potentials](./Action_potentials "Action potentials"), across a [neural network.](./Neural_network_(biology) "Neural network (biology)") These mathematical models describe the role of the biophysical and geometrical characteristics of neurons on the conduction of electrical activity.

Central to these models is the description of how the [membrane potential](./Membrane_potential "Membrane potential") (that is, the difference in [electric potential](./Electric_potential "Electric potential") between the interior and the exterior of a biological [cell](./Cell_(biology) "Cell (biology)")) across the [cell membrane](./Cell_membrane "Cell membrane") changes over time. In an experimental setting, stimulating neurons with an electrical current generates an [action potential](./Action_potential "Action potential") (or spike), that propagates down the neuron's [axon](./Axon "Axon"). This axon can branch out and connect to a large number of downstream neurons at sites called [synapses](./Synapse "Synapse"). At these synapses, the spike can cause the release of [neurotransmitters](./Neurotransmitter "Neurotransmitter"), which in turn can change the voltage potential of downstream neurons. This change can potentially lead to even more spikes in those downstream neurons, thus passing down the signal. As many as 95% of neurons in the [neocortex](./Neocortex "Neocortex"), the outermost layer of the [mammalian](./Mammal "Mammal") [brain](./Brain "Brain"), consist of excitatory [pyramidal neurons](./Pyramidal_cell "Pyramidal cell"),[[2]](./Biological_neuron_model#cite_note-2)[[3]](./Biological_neuron_model#cite_note-3) and each pyramidal neuron receives tens of thousands of inputs from other neurons.[[4]](./Biological_neuron_model#cite_note-4) Thus, spiking neurons are a major information processing unit of the [nervous system](./Nervous_system "Nervous system").

One such example of a spiking neuron model may be a highly detailed mathematical model that includes spatial [morphology](./Morphology_(biology) "Morphology (biology)"). Another may be a conductance-based neuron model that views neurons as points and describes the membrane voltage dynamics as a function of trans-membrane currents. A mathematically simpler "integrate-and-fire" model significantly simplifies the description of [ion channel](./Ion_channel "Ion channel") and membrane potential dynamics (initially studied by Lapicque in 1907).[[5]](./Biological_neuron_model#cite_note-5)[[6]](./Biological_neuron_model#cite_note-6)

## Biological background, classification, and aims of neuron models

**Non-spiking cells, spiking cells, and their measurement**

Not all the cells of the nervous system produce the type of spike that defines the scope of the spiking neuron models. For example, [cochlear](./Cochlea "Cochlea") [hair cells](./Hair_cells "Hair cells"), [retinal receptor cells](./Photoreceptor_cell "Photoreceptor cell"), and [retinal bipolar cells](./Retinal_bipolar_cell "Retinal bipolar cell") do not spike. Furthermore, many cells in the nervous system are not classified as neurons but instead are classified as [glia](./Glial_cell "Glial cell").

Neuronal activity can be measured with different experimental techniques, such as the "Whole cell" measurement technique, which captures the spiking activity of a single neuron and produces full amplitude action potentials.

With extracellular measurement techniques, one or more electrodes are placed in the [extracellular space](./Extracellular_space "Extracellular space"). Spikes, often from several spiking sources, depending on the size of the electrode and its proximity to the sources, can be identified with signal processing techniques. Extracellular measurement has several advantages:

- It is easier to obtain experimentally;
- It is robust and lasts for a longer time;
- It can reflect the dominant effect, especially when conducted in an anatomical region with many similar cells.

**Overview of neuron models**

Neuron models can be divided into two categories according to the physical units of the interface of the model. Each category could be further divided according to the abstraction/detail level:

1. [Electrical input–output membrane voltage models](./Biological_neuron_model#ElectricalModels) – These models produce a prediction for membrane output voltage as a function of electrical stimulation given as current or voltage input. The various models in this category differ in the exact functional relationship between the input current and the output voltage and in the level of detail. Some models in this category predict only the moment of occurrence of the output spike (also known as "action potential"); other models are more detailed and account for sub-cellular processes. The models in this category can be either deterministic or probabilistic.
2. [Natural](./Biological_neuron_model#NaturalModels) stimulus or [pharmacological input neuron models](./Biological_neuron_model#PharmacologicalModels) – The models in this category connect the input stimulus, which can be either pharmacological or natural, to the probability of a spike event. The input stage of these models is not electrical but rather has either pharmacological (chemical) concentration units, or physical units that characterize an external stimulus such as light, sound, or other forms of physical pressure. Furthermore, the output stage represents the probability of a spike event and not an electrical voltage.

Although it is not unusual in science and engineering to have several descriptive models for different abstraction/detail levels, the number of different, sometimes contradicting, biological neuron models is exceptionally high. This situation is partly the result of the many different experimental settings, and the difficulty to separate the intrinsic properties of a single neuron from measurement effects and interactions of many cells ([network](./Biological_neural_network "Biological neural network") effects).

**Aims of neuron models**

Ultimately, biological neuron models aim to explain the mechanisms underlying the operation of the nervous system. However, several approaches can be distinguished, from more realistic models (e.g., mechanistic models) to more pragmatic models (e.g., phenomenological models).[[7]](./Biological_neuron_model#cite_note-7)[*[better source needed](./Wikipedia:Verifiability#Questionable_sources "Wikipedia:Verifiability")*] Modeling helps to analyze experimental data and address questions. Models are also important in the context of restoring lost brain functionality through [neuroprosthetic](./Neuroprosthetics "Neuroprosthetics") devices.

## Electrical input–output membrane voltage models

The models in this category describe the relationship between neuronal membrane currents at the input stage and membrane voltage at the output stage. This category includes (generalized) integrate-and-fire models and biophysical models inspired by the work of Hodgkin–Huxley in the early 1950s using an experimental setup that punctured the cell membrane and allowed to force a specific membrane voltage/current.[[8]](./Biological_neuron_model#cite_note-Hod52-8)[[9]](./Biological_neuron_model#cite_note-:6-9)[[10]](./Biological_neuron_model#cite_note-:7-10)[[11]](./Biological_neuron_model#cite_note-:8-11)

Most modern [electrical neural interfaces](./Biological_neuron_model#ElectricalApplications) apply extra-cellular electrical stimulation to avoid membrane puncturing, which can lead to cell death and tissue damage. Hence, it is not clear to what extent the electrical neuron models hold for extra-cellular stimulation (see e.g.[[12]](./Biological_neuron_model#cite_note-:9-12)).

### Hodgkin–Huxley

Experimental evidence supporting the model

| Property of the H&H model | Ref. |
| --- | --- |
| The shape of an individual spike | [[8]](./Biological_neuron_model#cite_note-Hod52-8)[[9]](./Biological_neuron_model#cite_note-:6-9)[[10]](./Biological_neuron_model#cite_note-:7-10)[[11]](./Biological_neuron_model#cite_note-:8-11) |
| The identity of the ions involved | [[8]](./Biological_neuron_model#cite_note-Hod52-8)[[9]](./Biological_neuron_model#cite_note-:6-9)[[10]](./Biological_neuron_model#cite_note-:7-10)[[11]](./Biological_neuron_model#cite_note-:8-11) |
| Spike speed across the axon | [[8]](./Biological_neuron_model#cite_note-Hod52-8) |

Main article: [Hodgkin–Huxley model](./Hodgkin–Huxley_model "Hodgkin–Huxley model")

The [Hodgkin–Huxley model](./Hodgkin–Huxley_model "Hodgkin–Huxley model") (H&H model)[[8]](./Biological_neuron_model#cite_note-Hod52-8)[[9]](./Biological_neuron_model#cite_note-:6-9)[[10]](./Biological_neuron_model#cite_note-:7-10)[[11]](./Biological_neuron_model#cite_note-:8-11)
is a model of the relationship between the flow of ionic currents across the neuronal cell membrane and the membrane voltage of the cell.[[8]](./Biological_neuron_model#cite_note-Hod52-8)[[9]](./Biological_neuron_model#cite_note-:6-9)[[10]](./Biological_neuron_model#cite_note-:7-10)[[11]](./Biological_neuron_model#cite_note-:8-11) It consists of a set of [nonlinear differential equations](./Nonlinear_system#Nonlinear_differential_equations "Nonlinear system") describing the behavior of ion channels that permeate the cell membrane of the [squid giant axon](./Squid_giant_axon "Squid giant axon"). Hodgkin and Huxley were awarded the 1963 Nobel Prize in Physiology
